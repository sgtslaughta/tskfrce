"""
Content validation and sanitization utilities for TaaskMaaster.

This module provides utilities for validating and sanitizing rich text content,
including markdown and HTML, to prevent XSS attacks and ensure content quality.
"""

import re
import html
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from app.core.logging import get_logger

logger = get_logger(__name__)


class ContentValidator:
    """Content validation and sanitization utility class."""

    # Allowed HTML tags for rich text content
    ALLOWED_TAGS = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre',
        'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3',
        'h4', 'h5', 'h6', 'hr', 'del', 'ins', 'mark', 'small',
        'sub', 'sup', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    }

    # Allowed HTML attributes
    ALLOWED_ATTRIBUTES = {
        'a': ['href', 'title', 'target'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
        'code': ['class'],
        'pre': ['class'],
        'blockquote': ['cite'],
        'table': ['class'],
        'th': ['scope'],
        'td': ['colspan', 'rowspan']
    }

    # URL schemes that are allowed in links
    ALLOWED_URL_SCHEMES = {'http', 'https', 'mailto', 'tel'}

    # Maximum content length
    MAX_CONTENT_LENGTH = 10000

    # Markdown patterns for validation
    MARKDOWN_PATTERNS = {
        'bold': re.compile(r'\*\*(.+?)\*\*'),
        'italic': re.compile(r'\*(.+?)\*'),
        'code': re.compile(r'`(.+?)`'),
        'link': re.compile(r'\[([^\]]+)\]\(([^)]+)\)'),
        'heading': re.compile(r'^#+\s+(.+)$', re.MULTILINE),
        'list_item': re.compile(r'^\s*[-*+]\s+(.+)$', re.MULTILINE),
        'numbered_list': re.compile(r'^\s*\d+\.\s+(.+)$', re.MULTILINE),
        'blockquote': re.compile(r'^>\s+(.+)$', re.MULTILINE),
    }

    @classmethod
    def validate_content(
        cls,
        content: str,
        content_type: str = "markdown",
        max_length: Optional[int] = None
    ) -> Tuple[bool, List[str]]:
        """
        Validate content for safety and quality.

        Args:
            content: Content to validate
            content_type: Type of content (markdown, html, text)
            max_length: Maximum allowed length

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        # Check length
        max_len = max_length or cls.MAX_CONTENT_LENGTH
        if len(content) > max_len:
            errors.append(f"Content exceeds maximum length of {max_len} characters")

        # Check for empty content
        if not content.strip():
            errors.append("Content cannot be empty")

        # Content type specific validation
        if content_type == "markdown":
            markdown_errors = cls._validate_markdown(content)
            errors.extend(markdown_errors)
        elif content_type == "html":
            html_errors = cls._validate_html(content)
            errors.extend(html_errors)

        # Check for suspicious patterns
        suspicious_errors = cls._check_suspicious_patterns(content)
        errors.extend(suspicious_errors)

        return len(errors) == 0, errors

    @classmethod
    def sanitize_content(
        cls,
        content: str,
        content_type: str = "markdown"
    ) -> str:
        """
        Sanitize content to remove potentially harmful elements.

        Args:
            content: Content to sanitize
            content_type: Type of content (markdown, html, text)

        Returns:
            Sanitized content
        """
        if not content:
            return ""

        # Basic HTML entity encoding
        content = html.escape(content, quote=False)

        if content_type == "markdown":
            content = cls._sanitize_markdown(content)
        elif content_type == "html":
            content = cls._sanitize_html(content)
        elif content_type == "text":
            content = cls._sanitize_plain_text(content)

        # Remove excessive whitespace
        content = re.sub(r'\n{3,}', '\n\n', content)
        content = re.sub(r' {2,}', ' ', content)

        return content.strip()

    @classmethod
    def _validate_markdown(cls, content: str) -> List[str]:
        """
        Validate markdown-specific content.

        Args:
            content: Markdown content to validate

        Returns:
            List of validation errors
        """
        errors = []

        # Check for malformed links
        link_pattern = re.compile(r'\[([^\]]*)\]\(([^)]*)\)')
        for match in link_pattern.finditer(content):
            link_text, url = match.groups()
            if not url.strip():
                errors.append("Found link with empty URL")
            elif not cls._is_safe_url(url):
                errors.append(f"Unsafe URL detected: {url}")

        # Check for excessive nesting
        if content.count('*') > 20:
            errors.append("Excessive use of emphasis markers")

        # Check for code block balance
        code_blocks = content.count('```')
        if code_blocks % 2 != 0:
            errors.append("Unmatched code block markers")

        return errors

    @classmethod
    def _validate_html(cls, content: str) -> List[str]:
        """
        Validate HTML content.

        Args:
            content: HTML content to validate

        Returns:
            List of validation errors
        """
        errors = []

        # Check for script tags (should be blocked)
        if re.search(r'<script[^>]*>', content, re.IGNORECASE):
            errors.append("Script tags are not allowed")

        # Check for event handlers
        event_handlers = re.findall(r'on\w+\s*=', content, re.IGNORECASE)
        if event_handlers:
            errors.append("Event handlers are not allowed in HTML content")

        # Check for iframe tags
        if re.search(r'<iframe[^>]*>', content, re.IGNORECASE):
            errors.append("Iframe tags are not allowed")

        return errors

    @classmethod
    def _check_suspicious_patterns(cls, content: str) -> List[str]:
        """
        Check for suspicious patterns that might indicate malicious content.

        Args:
            content: Content to check

        Returns:
            List of suspicious pattern errors
        """
        errors = []

        # Check for JavaScript patterns
        js_patterns = [
            r'javascript:',
            r'eval\s*\(',
            r'document\.',
            r'window\.',
            r'alert\s*\(',
            r'confirm\s*\(',
            r'prompt\s*\(',
        ]

        for pattern in js_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                errors.append("Potentially malicious JavaScript pattern detected")
                break

        # Check for excessive special characters
        special_char_count = len(re.findall(r'[<>{}()[\]\\]', content))
        if special_char_count > len(content) * 0.1:  # More than 10% special chars
            errors.append("Excessive special characters detected")

        return errors

    @classmethod
    def _sanitize_markdown(cls, content: str) -> str:
        """
        Sanitize markdown content.

        Args:
            content: Markdown content to sanitize

        Returns:
            Sanitized markdown content
        """
        # Remove potentially dangerous markdown patterns
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.IGNORECASE | re.DOTALL)
        content = re.sub(r'<iframe[^>]*>.*?</iframe>', '', content, flags=re.IGNORECASE | re.DOTALL)
        
        # Sanitize links
        def sanitize_link(match):
            link_text, url = match.groups()
            if cls._is_safe_url(url):
                return f'[{link_text}]({url})'
            else:
                return link_text  # Remove unsafe link, keep text

        content = re.sub(r'\[([^\]]*)\]\(([^)]*)\)', sanitize_link, content)

        return content

    @classmethod
    def _sanitize_html(cls, content: str) -> str:
        """
        Sanitize HTML content by removing dangerous tags and attributes.

        Args:
            content: HTML content to sanitize

        Returns:
            Sanitized HTML content
        """
        # Remove script tags
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove event handlers
        content = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)
        
        # Remove iframe tags
        content = re.sub(r'<iframe[^>]*>.*?</iframe>', '', content, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove style attributes (potential for CSS injection)
        content = re.sub(r'\s*style\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)

        return content

    @classmethod
    def _sanitize_plain_text(cls, content: str) -> str:
        """
        Sanitize plain text content.

        Args:
            content: Plain text content to sanitize

        Returns:
            Sanitized plain text content
        """
        # For plain text, just ensure proper encoding and remove control characters
        content = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', content)
        return content

    @classmethod
    def _is_safe_url(cls, url: str) -> bool:
        """
        Check if a URL is safe to include in content.

        Args:
            url: URL to check

        Returns:
            True if URL is safe, False otherwise
        """
        try:
            parsed = urlparse(url.strip())
            
            # Check scheme
            if parsed.scheme.lower() not in cls.ALLOWED_URL_SCHEMES:
                return False
            
            # Check for javascript: URLs
            if parsed.scheme.lower() == 'javascript':
                return False
            
            # Check for data: URLs (can contain scripts)
            if parsed.scheme.lower() == 'data':
                return False
            
            # Check for suspicious patterns in URL
            if re.search(r'[<>"\']', url):
                return False
            
            return True
        except Exception:
            return False

    @classmethod
    def extract_mentions(cls, content: str) -> List[str]:
        """
        Extract @username mentions from content.

        Args:
            content: Content to scan for mentions

        Returns:
            List of mentioned usernames
        """
        # Pattern to match @username (alphanumeric + underscore, 3-30 chars)
        mention_pattern = re.compile(r'@([a-zA-Z0-9_]{3,30})')
        mentions = mention_pattern.findall(content)
        return list(set(mentions))  # Remove duplicates

    @classmethod
    def extract_links(cls, content: str, content_type: str = "markdown") -> List[Dict[str, str]]:
        """
        Extract links from content.

        Args:
            content: Content to scan for links
            content_type: Type of content (markdown, html, text)

        Returns:
            List of dictionaries with 'text' and 'url' keys
        """
        links = []

        if content_type == "markdown":
            # Extract markdown links
            link_pattern = re.compile(r'\[([^\]]*)\]\(([^)]*)\)')
            for match in link_pattern.finditer(content):
                link_text, url = match.groups()
                if cls._is_safe_url(url):
                    links.append({
                        'text': link_text.strip(),
                        'url': url.strip()
                    })

        elif content_type == "html":
            # Extract HTML links
            link_pattern = re.compile(r'<a[^>]+href=["\']([^"\']*)["\'][^>]*>([^<]*)</a>', re.IGNORECASE)
            for match in link_pattern.finditer(content):
                url, link_text = match.groups()
                if cls._is_safe_url(url):
                    links.append({
                        'text': link_text.strip(),
                        'url': url.strip()
                    })

        # Also extract plain URLs
        url_pattern = re.compile(r'https?://[^\s<>"\']+')
        for match in url_pattern.finditer(content):
            url = match.group()
            if cls._is_safe_url(url):
                links.append({
                    'text': url,
                    'url': url
                })

        return links
