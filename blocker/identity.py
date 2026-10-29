"""Device identity helpers: MAC vendor lookup and friendly display names."""

import csv
import re
from pathlib import Path

_OUI_PATH = Path(__file__).parent / "data" / "oui.csv"
_MAX_NAME = 100


def _load() -> dict[str, str]:
    with _OUI_PATH.open(newline="", encoding="utf-8") as f:
        rows = csv.reader(f)
        next(rows, None)
        return {r[0].upper(): r[1] for r in rows if len(r) >= 2}


_OUI = _load()


def vendor_for(mac: str) -> str | None:
    hexes = re.sub(r"[^0-9A-Fa-f]", "", mac).upper()
    return _OUI.get(hexes[:6])


def friendly_name(hostname: str | None, vendor: str | None) -> str:
    if hostname:
        name = hostname
    elif vendor:
        name = f"{vendor} device"
    else:
        name = "Unknown device"
    return name[:_MAX_NAME]
