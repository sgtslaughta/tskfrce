"""Blocker configuration loaded from environment and the shared secrets file."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    backend_url: str
    blocker_url_host: str
    internal_token: str
    lan_iface: str
    data_dir: Path
    blocker_port: int = 7777
    scan_interval: float = 20
    reconcile_interval: float = 30
    resist_interval: float = 15
    portal_redirect_url: str = "http://task4ce.local/kid"

    @classmethod
    def from_env(cls, environ: Mapping) -> Config:
        data_dir = Path(environ.get("DATA_DIR", "/data"))
        token = environ.get("INTERNAL_TOKEN") or _token_from_file(data_dir)
        if not token:
            raise RuntimeError("INTERNAL_TOKEN not set in env or secrets.json")
        return cls(
            backend_url=environ.get("BACKEND_URL", "http://backend:8000"),
            blocker_url_host=environ.get("BLOCKER_URL_HOST", "blocker"),
            internal_token=token,
            lan_iface=environ.get("LAN_IFACE", ""),
            data_dir=data_dir,
            blocker_port=int(environ.get("BLOCKER_PORT", 7777)),
            scan_interval=float(environ.get("SCAN_INTERVAL", 20)),
            reconcile_interval=float(environ.get("RECONCILE_INTERVAL", 30)),
            resist_interval=float(environ.get("RESIST_INTERVAL", 15)),
            portal_redirect_url=environ.get("PORTAL_REDIRECT_URL", "http://task4ce.local/kid"),
        )


def _token_from_file(data_dir: Path) -> str:
    path = data_dir / "secrets.json"
    if not path.is_file():
        return ""
    with path.open() as f:
        return str(json.load(f).get("INTERNAL_TOKEN", ""))
