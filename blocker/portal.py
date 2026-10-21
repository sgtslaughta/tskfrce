"""Captive portal: DNS responder answering with the box IP, HTTP redirect to the kid screen."""

from __future__ import annotations

import logging
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

log = logging.getLogger(__name__)


def dns_response(query_wire: bytes, answer_ip: str) -> bytes | None:
    """Answer a genuine A query with answer_ip; AAAA/others get NOERROR with no answer.

    Returns None (drop) for responses, non-zero opcodes, qdcount != 1 or unparsable input.
    """
    from scapy.layers.dns import DNS, DNSRR

    try:
        q = DNS(query_wire)
        if q.qr != 0 or q.opcode != 0 or q.qdcount != 1:
            return None
    except Exception:
        log.debug("dropping unparsable DNS packet", exc_info=True)
        return None
    try:
        first = q.qd[0]
    except (TypeError, IndexError):
        first = q.qd
    answers = []
    if first.qtype == 1:
        answers.append(DNSRR(rrname=first.qname, type="A", ttl=30, rdata=answer_ip))
    resp = DNS(id=q.id, qr=1, aa=1, rd=q.rd, ra=1, rcode=0, qd=[first], an=answers)
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
            if addr[1] == 53:
                continue
            try:
                out = dns_response(data, box_ip)
                if out is not None:
                    sock.sendto(out, addr)
            except Exception:
                log.debug("DNS handling failed", exc_info=True)
    finally:
        sock.close()


class PortalHTTP(BaseHTTPRequestHandler):
    """Redirect every request (including OS captive-check hosts) to the kid screen."""

    config = None
    timeout = 5

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
    srv = ThreadingHTTPServer(("0.0.0.0", 80), handler)
    srv.daemon_threads = True
    threading.Thread(target=lambda: (stop.wait(), srv.shutdown()), daemon=True).start()
    try:
        srv.serve_forever()
    finally:
        srv.server_close()
