"""Blocker HTTP API. Routes are registered in ROUTES for easy extension."""

from __future__ import annotations

import hmac
import json
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any


def _health(handler: _Handler) -> tuple[int, dict]:
    return 200, {"ok": True}


MAX_BODY = 64 * 1024


def _authorized(h: _Handler) -> bool:
    got = h.headers.get("X-Internal-Token") or ""
    return bool(got) and hmac.compare_digest(got.encode("utf-8"), h.server.token.encode("utf-8"))  # type: ignore[attr-defined]


def _json_body(h: _Handler) -> Any:
    try:
        length = max(0, int(h.headers.get("Content-Length") or 0))
    except ValueError:
        length = 0
    if length > MAX_BODY:
        raise ValueError("The request body is too large.")
    try:
        return json.loads(h.rfile.read(length) or b"null")
    except ValueError:
        return None


def _state(h: _Handler) -> tuple[int, dict]:
    if not _authorized(h):
        return 403, {"error": "forbidden"}
    try:
        body = _json_body(h)
    except ValueError as e:
        return 400, {"error": str(e)}
    if not isinstance(body, dict):
        return 400, {"error": "The request body must be a JSON object."}
    macs = body.get("blocked")
    if not isinstance(macs, list):
        return 400, {"error": "'blocked' must be a list of MAC addresses."}
    try:
        result = h.server.state.set_blocked(macs)  # type: ignore[attr-defined]
    except ValueError as e:
        return 400, {"error": str(e)}
    return 200, {"ok": True, "count": len(result)}


def _test_block(h: _Handler) -> tuple[int, dict]:
    if not _authorized(h):
        return 403, {"error": "forbidden"}
    try:
        body = _json_body(h)
    except ValueError as e:
        return 400, {"error": str(e)}
    if not isinstance(body, dict) or not isinstance(body.get("mac"), str):
        return 400, {"error": "The request body must be a JSON object with a 'mac' text value."}
    return 200, h.server.tester(body["mac"])  # type: ignore[attr-defined]


# (method, path) -> handler(request_handler) -> (status, json body)
ROUTES: dict[tuple[str, str], Callable[[_Handler], tuple[int, dict]]] = {
    ("GET", "/health"): _health,
    ("POST", "/state"): _state,
    ("POST", "/test-block"): _test_block,
}


class _Handler(BaseHTTPRequestHandler):
    def _dispatch(self, method: str) -> None:
        route = ROUTES.get((method, self.path))
        status, body = route(self) if route else (404, {"error": "not found"})
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        self._dispatch("GET")

    def do_POST(self) -> None:
        self._dispatch("POST")

    def log_message(self, format: str, *args: Any) -> None:
        pass


def make_api(
    state: Any, token: str, tester: Callable, host: str = "127.0.0.1", port: int = 0
) -> HTTPServer:
    server = HTTPServer((host, port), _Handler)
    server.state = state  # type: ignore[attr-defined]
    server.token = token  # type: ignore[attr-defined]
    server.tester = tester  # type: ignore[attr-defined]
    return server
