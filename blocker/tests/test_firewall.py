"""nftables render tests (pure; no root/nft needed)."""

from __future__ import annotations

from blocker.firewall import render_ruleset

LAN = ["192.168.1.0/24", "fe80::/10"]


MAC = {"de:ad:be:ef:00:01"}


def test_render_blocks_v4_and_v6_to_wan_allows_lan():
    r = render_ruleset({"192.168.1.50"}, {"fe80::50"}, MAC, LAN, "192.168.1.2", 8080)
    assert "192.168.1.50" in r
    assert "fe80::50" in r
    assert "ip saddr @blocked_v4 ip daddr { 192.168.1.0/24 } accept" in r
    assert "ip6 saddr @blocked_v6 ip6 daddr { fe80::/10 } accept" in r
    assert "ip saddr @blocked_v4 drop" in r
    assert "ip6 saddr @blocked_v6 drop" in r


def test_render_drops_by_mac_the_authoritative_key():
    r = render_ruleset(set(), set(), MAC, LAN, "192.168.1.2", 8080)
    assert "de:ad:be:ef:00:01" in r
    assert "ether saddr @blocked_mac drop" in r  # spoof-resistant drop even with no IP


def test_render_redirects_dns_and_http_drops_https():
    r = render_ruleset({"192.168.1.50"}, set(), MAC, LAN, "192.168.1.2", 8080)
    assert "udp dport 53 dnat ip to 192.168.1.2:53" in r
    assert "tcp dport 80 dnat ip to 192.168.1.2:8080" in r
    assert "tcp dport 443 drop" in r


def test_render_omits_dnat_when_no_portal_ip():
    # No box IP -> omit dnat (an invalid target would reject the whole ruleset),
    # but the device must still be blocked by the drop rules.
    r = render_ruleset({"192.168.1.50"}, set(), MAC, LAN, "", 80)
    assert "dnat" not in r
    assert "ip saddr @blocked_v4 drop" in r
    assert "ether saddr @blocked_mac drop" in r


def test_render_empty_set_is_noop_safe():
    r = render_ruleset(set(), set(), set(), LAN, "192.168.1.2", 8080)
    assert "elements" not in r  # no elements emitted when empty
    assert r.startswith("add table inet task4ce\nflush table inet task4ce\ntable inet task4ce {")
    assert r.rstrip().endswith("}")


def test_render_dns_to_port_53_http_to_portal_port():
    r = render_ruleset({"192.168.1.50"}, set(), MAC, LAN, "192.168.1.2", 8080)
    dns = [ln for ln in r.splitlines() if "dport 53 dnat" in ln]
    http = [ln for ln in r.splitlines() if "dport 80 dnat" in ln]
    assert len(dns) == 2 and all(ln.endswith(":53") for ln in dns)
    assert len(http) == 1 and http[0].endswith(":8080")
