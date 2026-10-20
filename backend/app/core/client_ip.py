"""Requesting device address."""

from fastapi import Request

LOOPBACK = {"127.0.0.1", "::1"}


def client_ip(request: Request) -> str:
    """Socket peer; X-Real-IP is trusted only when the peer is loopback (our own proxy)."""
    host = request.client.host if request.client else "unknown"
    real = request.headers.get("x-real-ip")
    return real.strip() if host in LOOPBACK and real else host
