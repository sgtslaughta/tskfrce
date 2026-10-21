"""nftables ruleset manager.

``render_ruleset`` is pure text. ``apply``/``flush``/``enable_forwarding`` do I/O
and run only under @integration tests (they need root + nft on a real host).
Everything fails open: ``flush`` removes our table so a dead blocker never bricks
the LAN.
"""

from __future__ import annotations

import logging
import subprocess

log = logging.getLogger(__name__)

TABLE = "task4ce"
DNS_PORT = 53


def _set_decl(name: str, typ: str, elements: set[str]) -> str:
    if elements:
        body = " elements = { " + ", ".join(sorted(elements)) + " }"
    else:
        body = ""
    return f"  set {name} {{ type {typ};{body} }}"


def render_ruleset(
    blocked_v4: set[str],
    blocked_v6: set[str],
    blocked_mac: set[str],
    lan_cidrs: list[str],
    portal_ip: str,
    portal_port: int,
) -> str:
    """Build the `table inet task4ce` text. Empty sets => matches nothing (noop-safe).

    Enforcement is keyed on MAC (`blocked_mac`), the app's authoritative block key:
    a device cannot evade its block by renumbering its IP. The IP sets drive the
    captive-portal redirect (which needs L3) and add defence in depth.
    """
    v4_lan = [c for c in lan_cidrs if ":" not in c]
    v6_lan = [c for c in lan_cidrs if ":" in c]
    lines = [f"add table inet {TABLE}", f"flush table inet {TABLE}", f"table inet {TABLE} {{"]
    lines.append(_set_decl("blocked_v4", "ipv4_addr", blocked_v4))
    lines.append(_set_decl("blocked_v6", "ipv6_addr", blocked_v6))
    lines.append(_set_decl("blocked_mac", "ether_addr", blocked_mac))
    # Redirect blocked HTTP/DNS to the captive portal; HTTPS can't be portal-ed, so drop it.
    # Portal redirect needs a valid box IP. Without one, omit the dnat rules
    # entirely (an invalid target would make `nft -f` reject the WHOLE ruleset,
    # silently dropping all enforcement) — the forward-chain drops below still
    # block the device; it just gets no friendly portal page.
    lines.append("  chain prerouting {")
    lines.append("    type nat hook prerouting priority -100; policy accept;")
    if portal_ip:
        lines.append(f"    ip saddr @blocked_v4 udp dport 53 dnat ip to {portal_ip}:{DNS_PORT}")
        lines.append(f"    ip saddr @blocked_v4 tcp dport 53 dnat ip to {portal_ip}:{DNS_PORT}")
        lines.append(f"    ip saddr @blocked_v4 tcp dport 80 dnat ip to {portal_ip}:{portal_port}")
    lines.append("  }")
    lines.append("  chain forward {")
    lines.append("    type filter hook forward priority 0; policy accept;")
    if v4_lan:
        lines.append(f"    ether saddr @blocked_mac ip daddr {{ {', '.join(v4_lan)} }} accept")
        lines.append(f"    ip saddr @blocked_v4 ip daddr {{ {', '.join(v4_lan)} }} accept")
    if v6_lan:
        lines.append(f"    ether saddr @blocked_mac ip6 daddr {{ {', '.join(v6_lan)} }} accept")
        lines.append(f"    ip6 saddr @blocked_v6 ip6 daddr {{ {', '.join(v6_lan)} }} accept")
    # Primary: drop by authoritative MAC (spoof-resistant). Secondary: drop by IP.
    lines.append("    ether saddr @blocked_mac drop")
    lines.append("    ip saddr @blocked_v4 tcp dport 443 drop")
    lines.append("    ip6 saddr @blocked_v6 tcp dport 443 drop")
    lines.append("    ip saddr @blocked_v4 drop")
    lines.append("    ip6 saddr @blocked_v6 drop")
    lines.append("  }")
    lines.append("}")
    return "\n".join(lines)


def apply(ruleset: str) -> None:
    """Load the ruleset via `nft -f -`. Raises on nft error (caller logs, fails open)."""
    subprocess.run(["nft", "-f", "-"], input=ruleset.encode(), check=True)


def flush() -> None:
    """Remove our table. Fail open: ignore 'No such file' when the table is absent."""
    subprocess.run(["nft", "delete", "table", "inet", TABLE], capture_output=True)


def enable_forwarding() -> None:
    """Enable IPv4 + IPv6 forwarding so redirected traffic can be routed."""
    for path in (
        "/proc/sys/net/ipv4/ip_forward",
        "/proc/sys/net/ipv6/conf/all/forwarding",
    ):
        try:
            with open(path, "w") as f:
                f.write("1\n")
        except OSError as e:
            log.warning("could not enable forwarding at %s: %s", path, e)
