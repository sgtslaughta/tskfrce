"""Blocker HTTP API. Routes are registered in ROUTES for easy extension."""

from __future__ import annotations

import json
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any


def _health(handler: _Handler) -> tuple[int, dict]:
    return 200, {"ok": True}


# (method, path) -> handler(request_handler) -> (status, json body)
ROUTES: dict[tuple[str, str], Callable[[_Handler], tuple[int, dict]]] = {
    ("GET", "/health"): _health,
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
