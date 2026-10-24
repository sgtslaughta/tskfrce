import re
from pathlib import Path

from app.flair.catalog import CATALOG

CSS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "v2" / "flair"
MOTION = "@media (prefers-reduced-motion: no-preference)"


def _css() -> str:
    return "\n".join(p.read_text() for p in sorted(CSS_DIR.glob("*.css")))


def _strip_motion(css: str) -> str:
    out, i = [], 0
    while (j := css.find(MOTION, i)) != -1:
        out.append(css[i:j])
        depth, k = 0, css.index("{", j)
        while True:
            depth += (css[k] == "{") - (css[k] == "}")
            if depth == 0:
                break
            k += 1
        i = k + 1
    out.append(css[i:])
    return "".join(out)


def test_every_non_emblem_catalog_id_has_css():
    css = _css()
    missing = [
        f.id
        for f in CATALOG
        if f.slot != "emblem" and not re.search(rf"\.flair-{re.escape(f.id)}(?![\w-])", css)
    ]
    assert not missing


def test_animations_only_under_reduced_motion_guard():
    css = _css()
    assert "animation:" in css
    assert "animation:" not in _strip_motion(css)
