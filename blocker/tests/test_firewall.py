"""nftables render tests (pure; no root/nft needed)."""

from __future__ import annotations

from blocker.firewall import render_ruleset

LAN = ["192.168.1.0/24", "fe80::/10"]


def test_render_blocks_v4_and_v6_to_wan_allows_lan():
    r = render_ruleset({"192.168.1.50"}, {"fe80::50"}, LAN, "192.168.1.2", 8080)
    assert "192.168.1.50" in r
    assert "fe80::50" in r
    assert "ip saddr @blocked_v4 ip daddr { 192.168.1.0/24 } accept" in r
    assert "ip6 saddr @blocked_v6 ip6 daddr { fe80::/10 } accept" in r
    assert "ip saddr @blocked_v4 drop" in r
    assert "ip6 saddr @blocked_v6 drop" in r


def test_render_redirects_dns_and_http_drops_https():
    r = render_ruleset({"192.168.1.50"}, set(), LAN, "192.168.1.2", 8080)
    assert "udp dport 53 dnat ip to 192.168.1.2:8080" in r
    assert "tcp dport 80 dnat ip to 192.168.1.2:8080" in r
    assert "tcp dport 443 drop" in r


def test_render_empty_set_is_noop_safe():
    r = render_ruleset(set(), set(), LAN, "192.168.1.2", 8080)
    assert "elements" not in r  # no elements emitted when empty
    assert r.startswith("table inet task4ce {")
    assert r.rstrip().endswith("}")
