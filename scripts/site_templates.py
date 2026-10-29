"""HTML templates for scripts/build_site.py: shared chrome and the two page layouts."""

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


def nav_card(href, side, label, title):
    """A previous/next chapter card (side is "prev" or "next")."""
    return f"""
    <a href="{href}" class="guide-nav-card guide-nav-{side}">
      <div class="guide-nav-label">{label}</div>
      <div class="guide-nav-title">{title}</div>
    </a>
"""


def chapter_page(title, summary_text, chapter_links, breadcrumb, toc_html, content_html, prev_link, next_link, first, source):
    """A guide chapter: chapter sidebar, body, prev/next cards."""
    return f"""<!doctype html>
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
          <nav class="guide-nav" aria-label="Chapters"{' data-first' if first else ''}>
            {prev_link}
            {next_link}
          </nav>

          <!-- Edit on GitHub -->
          <div class="guide-edit-link">
            <a href="https://github.com/sgtslaughta/tskfrce/blob/main/docs/guide/{source}" target="_blank" rel="noopener">
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


def standalone_page(title, chapter_links, breadcrumb, toc_html, content_html):
    """A page outside the chapter list (remote access): back link instead of chapters."""
    return f"""<!doctype html>
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
