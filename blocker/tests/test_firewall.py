"""nftables render tests (pure; no root/nft needed)."""

from __future__ import annotations

from blocker.firewall import render_ruleset
from blocker.service import DEFAULT_LAN_CIDRS

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


def test_render_drops_return_traffic_to_blocked_ips():
    # Bidirectional redirect: the spoofed gateway forwards the device's return
    # traffic to the box, which must drop it.
    r = render_ruleset({"192.168.1.50"}, {"fe80::50"}, MAC, LAN, "192.168.1.2", 8080)
    assert "ip daddr @blocked_v4 drop" in r
    assert "ip6 daddr @blocked_v6 drop" in r


def test_render_keeps_lan_to_blocked_reachable_in_order():
    r = render_ruleset({"192.168.1.50"}, {"fe80::50"}, MAC, LAN, "192.168.1.2", 8080)
    lines = [ln.strip() for ln in r.splitlines()]
    v4_lan = lines.index("ip saddr @blocked_v4 ip daddr { 192.168.1.0/24 } accept")
    v6_lan = lines.index("ip6 saddr @blocked_v6 ip6 daddr { fe80::/10 } accept")
    v4_in = lines.index("ip saddr { 192.168.1.0/24 } ip daddr @blocked_v4 accept")
    v6_in = lines.index("ip6 saddr { fe80::/10 } ip6 daddr @blocked_v6 accept")
    v4_drop = lines.index("ip daddr @blocked_v4 drop")
    v6_drop = lines.index("ip6 daddr @blocked_v6 drop")
    saddr_drop = lines.index("ether saddr @blocked_mac drop")
    assert v4_lan < v4_in < v4_drop < saddr_drop
    assert v6_lan < v6_in < v6_drop < saddr_drop


def test_render_omits_lan_to_blocked_accept_without_lan_family():
    r = render_ruleset({"192.168.1.50"}, set(), MAC, ["192.168.1.0/24"], "192.168.1.2", 80)
    assert "ip6 saddr {" not in r
    assert "ip saddr { 192.168.1.0/24 } ip daddr @blocked_v4 accept" in r


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


def test_locked_device_reaches_box_services():
    # ntfy (:2586) lives on the box's LAN address: a locked kid phone must still reach it.
    r = render_ruleset(set(), set(), MAC, DEFAULT_LAN_CIDRS, "192.168.1.2", 80)
    lines = [ln.strip() for ln in r.splitlines()]
    accept = next(
        i
        for i, ln in enumerate(lines)
        if ln.startswith("ether saddr @blocked_mac ip daddr {")
        and "172.16.0.0/12" in ln
        and ln.endswith("accept")
    )
    assert accept < lines.index("ether saddr @blocked_mac drop")
    pre = r.split("chain prerouting")[1].split("chain forward")[0]
    assert "2586" not in pre
