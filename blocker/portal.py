"""Captive portal: DNS responder answering with the box IP, HTTP redirect to the kid screen."""

from __future__ import annotations

import socket
from http.server import BaseHTTPRequestHandler, HTTPServer


def dns_response(query_wire: bytes, answer_ip: str) -> bytes:
    """Answer any A query with answer_ip; AAAA/others get NOERROR with no answer."""
    from scapy.layers.dns import DNS, DNSRR

    q = DNS(query_wire)
    answer = None
    if q.qd is not None and q.qd.qtype == 1:
        answer = DNSRR(rrname=q.qd.qname, type="A", ttl=30, rdata=answer_ip)
    resp = DNS(id=q.id, qr=1, aa=1, rd=q.rd, ra=1, rcode=0, qd=q.qd, an=answer)
    return bytes(resp)


def run_dns(cfg, box_ip: str, stop) -> None:
    """Serve dns_response over UDP :53 until stop (threading.Event) is set."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", 53))
    sock.settimeout(0.5)
    try:
        while not stop.is_set():
            try:
                data, addr = sock.recvfrom(512)
            except TimeoutError:
                continue
            try:
                sock.sendto(dns_response(data, box_ip), addr)
            except Exception:
                continue
    finally:
        sock.close()


class PortalHTTP(BaseHTTPRequestHandler):
    """Redirect every request (including OS captive-check hosts) to the kid screen."""

    config = None

    def _redirect(self):
        self.send_response(302)
        self.send_header("Location", self.config.portal_redirect_url)
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_GET = do_HEAD = do_POST = do_PUT = do_DELETE = do_OPTIONS = _redirect

    def log_message(self, format, *args):
        pass


def run_http(cfg, stop) -> None:
    """Serve PortalHTTP on :80 until stop (threading.Event) is set."""
    handler = type("Handler", (PortalHTTP,), {"config": cfg})
    srv = HTTPServer(("0.0.0.0", 80), handler)
    srv.timeout = 0.5
    try:
        while not stop.is_set():
            srv.handle_request()
    finally:
        srv.server_close()
