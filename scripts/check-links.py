#!/usr/bin/env python3
"""Check relative links and images in the docs. Usage: python3 scripts/check-links.py
Images listed in docs/guide/img/SHOTS.md that are missing are reported as pending, not failures."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [ROOT / "README.md", ROOT / "docs/engineering.md", ROOT / "docs/remote-access.md"]
FILES += sorted((ROOT / "docs/guide").glob("*.md")) + sorted((ROOT / "site").glob("*.html"))
MD_LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HTML_REF = re.compile(r"""(?:href|src)=["']([^"']+)["']""")
ANCHOR = re.compile(r"""<a\s+(?:id|name)=["']([^"']+)["']""")
SKIP = ("http://", "https://", "mailto:", "tel:", "data:", "//", "{{")


def slug(heading: str) -> str:
    h = re.sub(r"[^\w\s-]", "", heading.lower().replace("`", ""))
    return re.sub(r"\s", "-", h.strip())


def anchors(path: Path) -> set[str]:
    if path.suffix != ".md":
        return set(re.findall(r"""id=["']([^"']+)["']""", path.read_text()))
    text = path.read_text()
    found = set(ANCHOR.findall(text))
    in_code = False
    for line in text.splitlines():
        if line.startswith("```"):
            in_code = not in_code
        elif not in_code and (m := re.match(r"#{1,6}\s+(.*)", line)):
            found.add(slug(m.group(1)))
    return found


shots = set(re.findall(r"`([\w.-]+\.png)`", (ROOT / "docs/guide/img/SHOTS.md").read_text()))
bad, pending, checked = [], [], 0
for f in FILES:
    if not f.exists():
        continue
    text = f.read_text()
    refs = MD_LINK.findall(text) if f.suffix == ".md" else HTML_REF.findall(text)
    for ref in refs:
        if ref.startswith(SKIP):
            continue
        target, _, frag = ref.partition("#")
        checked += 1
        path = f if not target else (f.parent / target.split("?")[0])
        rel = f.relative_to(ROOT)
        if target and not path.exists():
            if path.name in shots and path.parent.name == "img":
                pending.append(f"{rel}: {ref}")
            else:
                bad.append(f"{rel}: missing file {ref}")
        elif frag and path.is_file() and frag not in anchors(path):
            bad.append(f"{rel}: missing anchor {ref}")
print(f"checked {checked} links in {len(FILES)} files")
for p in sorted(set(pending)):
    print(f"pending screenshot: {p}")
for b in bad:
    print(f"BROKEN: {b}")
sys.exit(1 if bad else 0)
