#!/usr/bin/env python3
"""
Build script to generate the t@sk4ce guide as static HTML pages.
Converts markdown guide files to styled HTML pages matching the main site.
"""

import html as html_lib
import re
import shutil
from pathlib import Path

try:
    import markdown
    from markdown.extensions import fenced_code, tables, toc
except ImportError:
    print("Error: markdown package not installed. Install with: pip install markdown")
    exit(1)

from site_templates import (  # noqa: E402 (needs the check above)
    chapter_page,
    nav_card,
    standalone_page,
)

# Configuration
GUIDE_SOURCE = Path("docs/guide")
REMOTE_ACCESS_SOURCE = Path("docs/remote-access.md")
SITE_OUTPUT = Path("site/guide")
IMG_SOURCE = GUIDE_SOURCE / "img"
IMG_OUTPUT = SITE_OUTPUT / "img"

# Guide chapters in order
GUIDE_CHAPTERS = [
    ("README.md", "Beginner's Guide"),
    ("01-what-you-need.md", "1. What you need"),
    ("02-install.md", "2. Install"),
    ("03-first-setup.md", "3. First-time setup"),
    ("04-everyday-use.md", "4. Everyday use"),
    ("05-for-kids.md", "5. For kids"),
    ("06-troubleshooting.md", "6. Troubleshooting"),
    ("07-faq.md", "7. FAQ"),
]

REMOTE_ACCESS_ENTRY = ("remote-access.md", "Remote access (Tailscale)")


def ensure_dirs():
    """Create output directories if they don't exist."""
    SITE_OUTPUT.mkdir(parents=True, exist_ok=True)
    IMG_OUTPUT.mkdir(parents=True, exist_ok=True)


def copy_images():
    """Copy images from docs/guide/img to site/guide/img."""
    if IMG_SOURCE.exists():
        for img_file in IMG_SOURCE.glob("*"):
            if img_file.is_file() and img_file.name != "SHOTS.md":
                shutil.copy2(img_file, IMG_OUTPUT / img_file.name)


def extract_headings(html):
    """Extract h2 and h3 headings for 'On this page' TOC."""
    headings = []
    h2_pattern = re.compile(r'<h2[^>]*id="([^"]*)"[^>]*>([^<]+)</h2>')
    h3_pattern = re.compile(r'<h3[^>]*id="([^"]*)"[^>]*>([^<]+)</h3>')

    for match in h2_pattern.finditer(html):
        headings.append(("h2", match.group(2), match.group(1)))
    for match in h3_pattern.finditer(html):
        headings.append(("h3", match.group(2), match.group(1)))

    return headings


def render_toc(headings):
    """Generate 'On this page' table of contents HTML."""
    if not headings:
        return ""

    html = '<div class="guide-toc">\n'
    html += '<h3>On this page</h3>\n'
    html += '<ul>\n'

    for level, text, anchor in headings:
        if level == "h2":
            html += f'<li><a href="#{anchor}">{text}</a></li>\n'
        elif level == "h3":
            html += f'<li style="margin-left: 1em;"><a href="#{anchor}">{text}</a></li>\n'

    html += '</ul>\n'
    html += '</div>\n'
    return html


def rewrite_links(html, source_file):
    """Rewrite markdown links to point to the correct locations."""
    # Links to other guide chapters: 0N-x.md[#anchor] -> 0N-x.html[#anchor]
    html = re.sub(r'href="(\d{2}-[^"]+)\.md([#"])', r'href="\1.html\2', html)

    # Links to README.md in guide: README.md[#anchor] -> index.html[#anchor]
    html = re.sub(r'href="README\.md([#"])', r'href="index.html\1', html)

    # Links to remote-access.md: ../remote-access.md or remote-access -> remote-access.html
    html = re.sub(r'href="\.\./remote-access\.md([#"]?)', r'href="remote-access.html\1', html)
    html = re.sub(r'href="remote-access([#"]?)"', r'href="remote-access.html\1"', html)

    # Links to engineering.md: ../engineering.md -> ../engineering.html
    html = re.sub(r'href="\.\./engineering\.md"', r'href="../engineering.html"', html)

    # Links to other repo files: docs/*.md, LICENSE, etc -> GitHub URLs
    html = re.sub(
        r'href="\.\./((?:routers|blocker)\.md)"',
        r'href="https://github.com/sgtslaughta/tskfrce/blob/main/docs/\1"',
        html,
    )
    html = re.sub(
        r'href="\.\./\.\./(LICENSE)"',
        r'href="https://github.com/sgtslaughta/tskfrce/blob/main/\1"',
        html,
    )

    return html


def build_page_html(content_html, title, chapters_list, current_idx, headings):
    """Build complete HTML page with site styling."""
    # Remove the first <h1> from content (will be in header instead)
    content_html = re.sub(r'<h1[^>]*>.+?</h1>\n?', '', content_html, count=1, flags=re.DOTALL)

    # Find previous and next chapters
    prev_ch = chapters_list[current_idx - 1] if current_idx > 0 else None
    next_ch = chapters_list[current_idx + 1] if current_idx < len(chapters_list) - 1 else None

    prev_link = ""
    if prev_ch:
        prev_file, prev_title = prev_ch
        prev_html = get_output_filename(prev_file)
        prev_link = nav_card(prev_html, "prev", "← Previous", prev_title)

    next_link = ""
    if next_ch:
        next_file, next_title = next_ch
        next_html = get_output_filename(next_file)
        next_link = nav_card(next_html, "next", "Next →", next_title)

    toc_html = render_toc(headings)

    # Build chapter list
    chapter_links = ""
    for i, (ch_file, ch_title) in enumerate(chapters_list):
        ch_url = get_output_filename(ch_file)
        is_active = i == current_idx
        active_class = " active" if is_active else ""
        current = ' aria-current="page"' if is_active else ''
        chapter_links += f'<a href="{ch_url}" class="guide-chapter-link{active_class}"{current}>{ch_title}</a>\n'

    # Build breadcrumb
    breadcrumb = "Guide"
    if current_idx > 0:  # Not the intro page
        breadcrumb = f"Guide › {title}"

    # Build chapter summary for mobile (closed by default)
    chapter_count = len(chapters_list)
    current_num = current_idx + 1
    if current_idx == 0:
        summary_text = f"Chapters ({chapter_count})"
    else:
        summary_text = f"Chapter {current_num} of {chapter_count} · {title}"

    return chapter_page(
        title, summary_text, chapter_links, breadcrumb, toc_html, content_html,
        prev_link, next_link, first=not prev_ch, source=chapters_list[current_idx][0],
    )


def get_output_filename(source_filename):
    """Convert source markdown filename to output HTML filename."""
    if source_filename == "README.md":
        return "index.html"
    elif source_filename == "remote-access.md":
        return "remote-access.html"
    else:
        return source_filename.replace(".md", ".html")


def markdown_to_html(md_text):
    """Convert markdown to HTML with extensions."""
    md = markdown.Markdown(
        extensions=[
            tables.TableExtension(),
            fenced_code.FencedCodeExtension(),
            toc.TocExtension(permalink=True, permalink_class="header-link"),
        ]
    )
    html = md.convert(md_text)
    return html


def process_guide_file(source_file, all_chapters, chapter_idx):
    """Process a single guide markdown file and generate HTML."""
    if not source_file.exists():
        print(f"Warning: {source_file} not found, skipping")
        return None

    with open(source_file) as f:
        md_content = f.read()

    # Strip maintainer notes from README
    if source_file.name == "README.md":
        # Remove the "Screenshots in this guide are listed in..." line
        md_content = re.sub(
            r'\nScreenshots in this guide are listed in.*?\n',
            '\n',
            md_content,
            flags=re.DOTALL
        )

    # Convert markdown to HTML
    html = markdown_to_html(md_content)

    # Extract title from first h1 or use chapter title
    title_match = re.search(r"<h1[^>]*>(.+?)</h1>", html, re.DOTALL)
    if title_match:
        # Extract text content, removing any tags
        title_html = title_match.group(1)
        title = re.sub(r"<[^>]+>", "", title_html).strip()
        title = html_lib.unescape(title)
    else:
        title = "t@sk4ce Guide"

    # Clean up title
    title = title.strip("#").strip()
    title = title.rstrip("¶").strip()  # Remove pilcrow from header-link

    # Extract headings for TOC
    headings = extract_headings(html)

    # Rewrite links
    html = rewrite_links(html, source_file)

    # Add copy buttons to code blocks
    html = add_copy_buttons(html)

    # Add callout styling
    html = style_callouts(html)

    # Build complete page HTML
    page_html = build_page_html(html, title, all_chapters, chapter_idx, headings)

    return page_html


def add_copy_buttons(html):
    """Add copy buttons to code blocks."""
    # Pattern to match <pre><code>...</code></pre>
    pattern = r'(<pre><code[^>]*>)(.*?)(</code></pre>)'

    def replace_code_block(match):
        prefix = match.group(1)
        code = match.group(2)
        suffix = match.group(3)
        # Plain text of the code, kept in a data attribute (an inline JS string broke on quotes)
        code_text = html_lib.unescape(re.sub(r"<[^>]+>", "", code)).strip()
        attr = html_lib.escape(code_text, quote=True)
        button = (
            f'<div class="code-block-wrapper">'
            f'<button class="copy-btn" type="button" data-copy="{attr}" '
            f'onclick="copyToClipboard(this.dataset.copy, this)">📋 Copy</button>'
            f"{prefix}{code}{suffix}"
            f"</div>"
        )
        return button

    html = re.sub(pattern, replace_code_block, html, flags=re.DOTALL)
    return html


def style_callouts(html):
    """Style callouts for 'You should see:' and warnings."""
    # Style "You should see:" lines (success callout)
    html = re.sub(
        r'<p>You should see:',
        '<p class="callout callout-success">You should see:',
        html,
    )

    # Style warning patterns (soft coral callout)
    warning_patterns = [
        "Warning:",
        "Warning —",
        "Important:",
        "Note:",
        "Caution:",
    ]
    for pattern in warning_patterns:
        html = re.sub(
            rf'<p>({re.escape(pattern)})',
            r'<p class="callout callout-warning">\1',
            html,
        )

    return html


def build_site():
    """Build the entire guide site."""
    print("Building t@sk4ce guide site...")

    ensure_dirs()
    copy_images()

    # Build all guide chapters
    all_chapters = list(GUIDE_CHAPTERS)
    # Add remote-access if it exists
    if REMOTE_ACCESS_SOURCE.exists():
        all_chapters.append(REMOTE_ACCESS_ENTRY)

    for idx, (source_file, chapter_title) in enumerate(GUIDE_CHAPTERS):
        source_path = GUIDE_SOURCE / source_file
        output_filename = get_output_filename(source_file)
        output_path = SITE_OUTPUT / output_filename

        print(f"  Building {output_filename}...")
        page_html = process_guide_file(source_path, all_chapters, idx)

        if page_html:
            with open(output_path, "w") as f:
                f.write(page_html)

    # Build remote-access page separately (not in main chapter list navigation)
    if REMOTE_ACCESS_SOURCE.exists():
        print("  Building remote-access.html...")
        # For remote-access, create a standalone page without chapter nav
        with open(REMOTE_ACCESS_SOURCE) as f:
            md_content = f.read()

        html = markdown_to_html(md_content)
        title_match = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
        title = title_match.group(1) if title_match else "Remote access"

        html = rewrite_links(html, "remote-access.md")
        html = add_copy_buttons(html)
        html = style_callouts(html)

        # For remote-access, use simplified page without chapter nav
        page_html = build_standalone_page(html, title)

        with open(SITE_OUTPUT / "remote-access.html", "w") as f:
            f.write(page_html)

    print("✓ Guide site built successfully!")
    print(f"  Output: {SITE_OUTPUT}")


def build_standalone_page(content_html, title):
    """Build a standalone page (like remote-access) without chapter navigation."""
    # Remove the first <h1> from content (will be in header instead)
    content_html = re.sub(r'<h1[^>]*>.+?</h1>\n?', '', content_html, count=1, flags=re.DOTALL)

    headings = extract_headings(content_html)
    toc_html = render_toc(headings)

    chapter_links = '<a href="index.html" class="guide-chapter-link">← Back to guide</a>\n'

    # Breadcrumb
    breadcrumb = f"Guide › {title}"

    return standalone_page(title, chapter_links, breadcrumb, toc_html, content_html)


if __name__ == "__main__":
    build_site()
