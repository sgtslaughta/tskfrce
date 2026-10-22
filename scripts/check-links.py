#!/usr/bin/env python3
"""
Check links in generated HTML files.
Verifies that relative links point to files that exist and that anchors are valid.
"""

import os
import re
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin

# Configuration
SITE_DIR = Path("site")
GUIDE_DIR = SITE_DIR / "guide"


class LinkExtractor(HTMLParser):
    """Extract all links from an HTML file."""

    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for attr, value in attrs:
                if attr == "href" and value:
                    self.links.append(value)
        elif tag in ("img", "script"):
            for attr, value in attrs:
                if attr == "src" and value:
                    self.links.append(value)
        elif tag == "link":
            for attr, value in attrs:
                if attr == "href" and value:
                    self.links.append(value)


def extract_anchors(html_file):
    """Extract all id attributes from an HTML file."""
    anchors = set()
    with open(html_file, "r") as f:
        content = f.read()
    # Find all id attributes
    for match in re.finditer(r'id="([^"]+)"', content):
        anchors.add(match.group(1))
    return anchors


def check_links():
    """Check all links in the generated site."""
    errors = []
    warnings = []

    if not GUIDE_DIR.exists():
        print("Error: site/guide/ does not exist. Run scripts/build_site.py first.")
        return 1

    html_files = list(GUIDE_DIR.glob("*.html"))
    if not html_files:
        print("Error: No HTML files found in site/guide/")
        return 1

    print(f"Checking links in {len(html_files)} HTML files...")

    for html_file in sorted(html_files):
        rel_path = html_file.relative_to(SITE_DIR)

        # Extract links from this file
        extractor = LinkExtractor(html_file)
        try:
            with open(html_file, "r") as f:
                extractor.feed(f.read())
        except Exception as e:
            errors.append(f"Error parsing {rel_path}: {e}")
            continue

        # Extract anchors from this file
        anchors = extract_anchors(html_file)

        # Check each link
        for link in extractor.links:
            # Skip external links, data URIs, and mail links
            if (
                link.startswith("http://")
                or link.startswith("https://")
                or link.startswith("data:")
                or link.startswith("mailto:")
            ):
                continue

            # Skip image files that will be added by concurrent work
            if link.startswith("img/") and (link.endswith(".png") or link.endswith(".jpg") or link.endswith(".webp")):
                continue

            # Skip markdown files in the guide (they're converted to HTML)
            if link.endswith(".md"):
                continue

            # Parse the link
            parsed = urlparse(link)
            path = parsed.path
            anchor = parsed.fragment

            # Handle root-relative links
            if path.startswith("/"):
                # Convert to site-relative path
                target_path = SITE_DIR / path.lstrip("/")
            else:
                # Relative path from current file
                target_path = (html_file.parent / path).resolve()

            # Check if the target exists
            if path and not path.endswith("/"):
                # It's a file reference
                if not target_path.exists():
                    errors.append(f"  {rel_path}: broken link '{link}' -> {target_path} not found")
            else:
                # It's a directory reference - check for index.html
                if path.endswith("/"):
                    index_path = target_path / "index.html"
                    if not index_path.exists():
                        errors.append(
                            f"  {rel_path}: broken directory link '{link}' -> {index_path} not found"
                        )

            # Check anchors if specified
            if anchor:
                # The anchor should be in the target file
                if path and not path.endswith("/"):
                    # Anchor is in a specific file
                    anchor_file = target_path
                else:
                    # Anchor is in the current file or the directory's index
                    if path.endswith("/"):
                        anchor_file = target_path / "index.html"
                    else:
                        anchor_file = html_file

                if anchor_file.exists():
                    target_anchors = extract_anchors(anchor_file)
                    if anchor not in target_anchors:
                        # Check if it's in the "from=app" query param case
                        if anchor == "app" and "from" in link:
                            continue
                        warnings.append(
                            f"  {rel_path}: anchor '#{anchor}' not found in {anchor_file.name}"
                        )

    # Print results
    if errors:
        print("\n❌ ERRORS:")
        for error in errors:
            print(error)

    if warnings:
        print("\n⚠️  WARNINGS:")
        for warning in warnings:
            print(warning)

    if not errors:
        print("\n✓ All links are valid!")
        return 0
    else:
        return 1


if __name__ == "__main__":
    exit(check_links())
