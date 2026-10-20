"""Requesting device address."""

import ipaddress

from fastapi import Request

from app.core.config import settings


def norm_ip(x: str | None) -> str | None:
    """Canonical form (IPv4-mapped IPv6 -> IPv4, zone id dropped); None if not an IP."""
    try:
        a = ipaddress.ip_address(str(x).split("%")[0].strip())
    except ValueError:
        return None
    return str(getattr(a, "ipv4_mapped", None) or a)


def _trusted() -> set[str]:
    return {n for p in settings.TRUSTED_PROXY_IPS.split(",") if (n := norm_ip(p))}


def client_ip(request: Request) -> str:
    """Normalized socket peer; X-Real-IP is trusted only from TRUSTED_PROXY_IPS (our proxy)."""
    raw = request.client.host if request.client else "unknown"
    host = norm_ip(raw) or raw
    real = norm_ip(request.headers.get("x-real-ip"))
    return real if real and host in _trusted() else host
