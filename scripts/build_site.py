#!/usr/bin/env python3
"""
Build script to generate the t@sk4ce guide as static HTML pages.
Converts markdown guide files to styled HTML pages matching the main site.
"""

import os
import re
import shutil
import html as html_lib
from pathlib import Path
from urllib.parse import quote

try:
    import markdown
    from markdown.extensions import tables, fenced_code, toc
except ImportError:
    print("Error: markdown package not installed. Install with: pip install markdown")
    exit(1)


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


# Shared page chrome (matches site/index.html)
FONTS = """  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap">"""

BAR = """    <header class="f-bar">
      <a href="../" class="f-wordmark"><span class="f-logo" aria-hidden="true">@</span>t@sk4ce</a>
      <nav class="f-bar-buttons" aria-label="Site">
        <a id="back-to-app" class="f-back" style="display: none;" href="../?from=app">← Back to app</a>
        <a class="f-nav" aria-current="page" href="index.html">Guide</a>
        <a class="f-nav" data-wide href="../engineering.html">Engineering</a>
      </nav>
    </header>"""

FOOTER = """    <footer class="f-footer">
      <div class="f-footer-cols">
        <div>
          <a href="../" class="f-wordmark"><span class="f-logo" aria-hidden="true">@</span>t@sk4ce</a>
          <p>Chores first, then screens.</p>
        </div>
        <div>
          <h2>t@sk4ce</h2>
          <ul>
            <li><a href="https://github.com/sgtslaughta/tskfrce">GitHub</a></li>
            <li><a href="https://github.com/sgtslaughta/tskfrce/blob/main/LICENSE">GPL-3.0</a></li>
          </ul>
        </div>
        <div>
          <h2>Help</h2>
          <ul>
            <li><a href="index.html">Start the guide</a></li>
            <li><a href="06-troubleshooting.html">Troubleshooting</a></li>
          </ul>
        </div>
        <div>
          <h2>For developers</h2>
          <ul>
            <li><a href="../engineering.html">Architecture</a></li>
          </ul>
        </div>
      </div>
      <p class="f-footer-note">t@sk4ce: Chores first, then screens. Free, open-source family software.</p>
    </footer>"""


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
        prev_link = f"""
    <a href="{prev_html}" class="guide-nav-card guide-nav-prev">
      <div class="guide-nav-label">← Previous</div>
      <div class="guide-nav-title">{prev_title}</div>
    </a>
"""

    next_link = ""
    if next_ch:
        next_file, next_title = next_ch
        next_html = get_output_filename(next_file)
        next_link = f"""
    <a href="{next_html}" class="guide-nav-card guide-nav-next">
      <div class="guide-nav-label">Next →</div>
      <div class="guide-nav-title">{next_title}</div>
    </a>
"""

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

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — t@sk4ce</title>
  <meta name="description" content="t@sk4ce beginner's guide for parents.">
{FONTS}
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="../guide.css">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <script>
    // Back to app link (only show if from=app)
    window.addEventListener('load', function() {{
      const params = new URLSearchParams(window.location.search);
      const fromApp = params.get('from') === 'app';
      sessionStorage.setItem('guideFromApp', fromApp);
      const backBtn = document.getElementById('back-to-app');
      if (backBtn) {{
        backBtn.style.display = fromApp ? 'flex' : 'none';
      }}

      // Restore scroll position and "from=app" across guide pages
      window.addEventListener('beforeunload', function() {{
        sessionStorage.setItem('guideScrollPos', window.scrollY);
      }});
    }});

    // Copy button for code blocks
    function copyToClipboard(text, btn) {{
      navigator.clipboard.writeText(text).then(() => {{
        const original = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => {{
          btn.textContent = original;
          btn.classList.remove('copied');
        }}, 2000);
      }});
    }}
  </script>
</head>
<body>
  <div class="f-shell">
{BAR}

    <main class="guide-layout">
      <!-- Chapter sidebar (desktop) / collapsible (mobile) -->
      <aside class="guide-sidebar">
        <details class="guide-chapters-toggle">
          <summary>{summary_text}</summary>
          <nav class="guide-chapters">
            {chapter_links}
          </nav>
        </details>
        <script>
          // desktop: sidebar always open; phone: starts closed
          if (matchMedia('(min-width: 961px)').matches) document.querySelector('.guide-chapters-toggle').open = true;
        </script>
      </aside>

      <!-- Main content -->
      <article class="guide-content">
        <div class="guide-content-inner">
          <header class="guide-header">
            <div class="guide-crumb">{breadcrumb}</div>
            <h1>{title}</h1>
          </header>

          <div class="guide-body">
            {toc_html}
            {content_html}
          </div>

          <!-- Previous/Next navigation -->
          <nav class="guide-nav" aria-label="Chapters"{' data-first' if not prev_ch else ''}>
            {prev_link}
            {next_link}
          </nav>

          <!-- Edit on GitHub -->
          <div class="guide-edit-link">
            <a href="https://github.com/sgtslaughta/tskfrce/blob/main/docs/guide/{chapters_list[current_idx][0]}" target="_blank" rel="noopener">
              Edit this page on GitHub →
            </a>
          </div>
        </div>
      </article>
    </main>

{FOOTER}
  </div>
</body>
</html>
"""
    return html


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

    with open(source_file, "r") as f:
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
        # Extract plain text from code (remove HTML tags)
        code_text = re.sub(r"<[^>]+>", "", code)
        code_text = code_text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
        # Escape quotes for JavaScript
        code_text_js = code_text.replace('"', '\\"').replace("\n", "\\n")
        button = (
            f'<div class="code-block-wrapper">'
            f'<button class="copy-btn" onclick="copyToClipboard(\"{code_text_js}\", this)">📋 Copy</button>'
            f'{prefix}{code}{suffix}'
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
            rf'<p class="callout callout-warning">\1',
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
        print(f"  Building remote-access.html...")
        # For remote-access, create a standalone page without chapter nav
        with open(REMOTE_ACCESS_SOURCE, "r") as f:
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

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — t@sk4ce</title>
  <meta name="description" content="t@sk4ce beginner's guide for parents.">
{FONTS}
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="../guide.css">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <script>
    // Back to app link
    window.addEventListener('load', function() {{
      const params = new URLSearchParams(window.location.search);
      const fromApp = params.get('from') === 'app';
      const backBtn = document.getElementById('back-to-app');
      if (backBtn) {{
        backBtn.style.display = fromApp ? 'flex' : 'none';
      }}
    }});

    function copyToClipboard(text, btn) {{
      navigator.clipboard.writeText(text).then(() => {{
        const original = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => {{
          btn.textContent = original;
          btn.classList.remove('copied');
        }}, 2000);
      }});
    }}
  </script>
</head>
<body>
  <div class="f-shell">
{BAR}

    <main class="guide-layout">
      <!-- Chapter sidebar -->
      <aside class="guide-sidebar">
        <nav class="guide-chapters">
          {chapter_links}
        </nav>
      </aside>

      <!-- Main content -->
      <article class="guide-content">
        <div class="guide-content-inner">
          <header class="guide-header">
            <div class="guide-crumb">{breadcrumb}</div>
            <h1>{title}</h1>
          </header>

          <div class="guide-body">
            {toc_html}
            {content_html}
          </div>

          <!-- Edit on GitHub -->
          <div class="guide-edit-link">
            <a href="https://github.com/sgtslaughta/tskfrce/blob/main/docs/remote-access.md" target="_blank" rel="noopener">
              Edit this page on GitHub →
            </a>
          </div>
        </div>
      </article>
    </main>

{FOOTER}
  </div>
</body>
</html>
"""
    return html


if __name__ == "__main__":
    build_site()
