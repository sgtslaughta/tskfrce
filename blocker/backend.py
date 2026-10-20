"""HTTP client for the backend's internal device-report and state endpoints."""

from __future__ import annotations

import json
import logging
import urllib.request
from dataclasses import asdict, dataclass

from blocker.config import Config

log = logging.getLogger(__name__)

TIMEOUT = 5
_BASE = "/api/v1/internal"


@dataclass
class Seen:
    mac: str
    ip: str | None
    ipv6: list[str]
    hostname: str | None
    vendor: str | None


def _request(cfg: Config, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-Internal-Token": cfg.internal_token}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        cfg.backend_url.rstrip("/") + _BASE + path,
        data=data,
        headers=headers,
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read())


def report_seen(cfg: Config, seen: Seen) -> int | None:
    try:
        return int(_request(cfg, "/devices/seen", asdict(seen))["id"])
    except Exception as e:
        log.warning("report_seen failed for %s: %s", seen.mac, e)
        return None


def fetch_blocked(cfg: Config) -> list[str] | None:
    try:
        return [str(m) for m in _request(cfg, "/state")["blocked"]]
    except Exception as e:
        log.warning("fetch_blocked failed: %s", e)
        return None
