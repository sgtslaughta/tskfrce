import http.client
import threading
from http.server import HTTPServer

import pytest

from blocker.config import Config
from blocker.portal import PortalHTTP, dns_response


def _cfg(tmp_path):
    return Config(
        backend_url="http://b",
        blocker_url_host="blocker",
        internal_token="t",
        lan_iface="",
        data_dir=tmp_path,
    )


def _query(qtype):
    pytest.importorskip("scapy")
    from scapy.layers.dns import DNS, DNSQR

    return bytes(DNS(id=0x1234, rd=1, qd=DNSQR(qname="example.com.", qtype=qtype)))


def test_dns_response_answers_a_with_box_ip():
    pytest.importorskip("scapy")
    from scapy.layers.dns import DNS

    resp = DNS(dns_response(_query("A"), "192.168.1.5"))
    assert resp.id == 0x1234
    assert resp.qr == 1
    assert resp.rcode == 0
    assert resp.qd.qname == b"example.com."
    assert resp.ancount == 1
    assert resp.an.rdata == "192.168.1.5"


def test_dns_response_aaaa_noerror_no_answer():
    pytest.importorskip("scapy")
    from scapy.layers.dns import DNS

    resp = DNS(dns_response(_query("AAAA"), "192.168.1.5"))
    assert resp.id == 0x1234
    assert resp.rcode == 0
    assert resp.ancount == 0


@pytest.fixture
def portal(tmp_path):
    cfg = _cfg(tmp_path)

    class H(PortalHTTP):
        config = cfg

    srv = HTTPServer(("127.0.0.1", 0), H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    yield srv.server_address[1], cfg
    srv.shutdown()
    srv.server_close()


@pytest.mark.parametrize(
    "path,host",
    [
        ("/anything", "example.com"),
        ("/hotspot-detect.html", "captive.apple.com"),
        ("/generate_204", "connectivitycheck.gstatic.com"),
        ("/connecttest.txt", "www.msftconnecttest.com"),
    ],
)
def test_portal_http_redirects_to_kid_screen(portal, path, host):
    port, cfg = portal
    c = http.client.HTTPConnection("127.0.0.1", port)
    c.request("GET", path, headers={"Host": host})
    r = c.getresponse()
    assert r.status == 302
    assert r.getheader("Location") == cfg.portal_redirect_url
    c.close()


def test_portal_http_has_connection_timeout():
    assert PortalHTTP.timeout == 5


def test_dns_response_drops_response_packet():
    pytest.importorskip("scapy")
    from scapy.layers.dns import DNS, DNSQR

    wire = bytes(DNS(id=1, qr=1, qd=DNSQR(qname="example.com.")))
    assert dns_response(wire, "192.168.1.5") is None


def test_dns_response_drops_nonzero_opcode():
    pytest.importorskip("scapy")
    from scapy.layers.dns import DNS, DNSQR

    wire = bytes(DNS(id=1, opcode=2, qd=DNSQR(qname="example.com.")))
    assert dns_response(wire, "192.168.1.5") is None


def test_dns_response_drops_qdcount_not_one():
    pytest.importorskip("scapy")
    from scapy.layers.dns import DNS, DNSQR

    wire = bytes(DNS(id=1, qd=DNSQR(qname="a.com.") / DNSQR(qname="b.com.")))
    assert dns_response(wire, "192.168.1.5") is None
    assert dns_response(bytes(DNS(id=1, qdcount=0)), "192.168.1.5") is None


def test_dns_response_drops_garbage():
    pytest.importorskip("scapy")
    assert dns_response(b"\xff\x00garbage", "192.168.1.5") is None
