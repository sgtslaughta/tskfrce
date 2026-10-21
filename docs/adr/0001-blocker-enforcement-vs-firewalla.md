# ADR 0001: LAN blocker enforcement strategy (vs. Firewalla)

**Date:** 2026-10-21
**Status:** Accepted
**Supersedes:** none. Refines spec §4 / §4.1a (`docs/superpowers/specs/2026-10-20-task4ce-v2-design.md`).

## Context

t@sk4ce pauses a kid's internet until chores are approved. v2 enforces this
with a Raspberry Pi / Docker box on the home LAN that redirects a blocked
device's traffic to itself (ARP for IPv4, NDP for IPv6), drops its
internet-bound packets with nftables, and serves an "Internet is paused"
captive portal. Firewalla is the closest commercial product; we evaluated
whether to change approach.

### Comparison

| | t@sk4ce box | Firewalla (simple mode) | Firewalla (router/DHCP mode) |
|---|---|---|---|
| Mechanism | ARP/NDP redirect + nftables drop | ARP spoofing | Inline router or DHCP gateway |
| Beats "change DNS / VPN" | Yes: all internet-bound packets dropped | Yes | Yes |
| Beats admin kid with static ARP / static gateway | No | No | Yes (router mode only) |
| Works with routers that do ARP inspection / client isolation (some mesh) | No; "Test block" + compat list | No; documented workarounds | Yes |
| Install burden | Plug box into LAN | Plug box into LAN | Replace or reconfigure router |
| Failure mode | Fails open (box dies → kids back online) | Fails open | Fails closed (no router/DHCP → whole family offline) |
| Kid-facing explanation | Captive portal → kid screen with chores | None (spinner) | None |
| Chore-driven unblock | Native, the product | None; no stable public API | None |
| Price / openness | Free, OSS, Pi you own | $200–500, closed firmware, cloud app | same |
| Threat detection, QoS, category/app blocking | No | Yes | Yes |

Things we got wrong during evaluation and corrected:

- **"Add VPN-protocol drop" was unnecessary.** A blocked device already has
  every internet-bound packet dropped, so a VPN cannot form. Not built.
- **DHCP mode does not stop the admin kid.** A kid who can set a static IP
  and gateway on their device bypasses DHCP mode exactly as they bypass ARP
  mode. DHCP mode only fixes router anti-spoofing incompatibility, and it
  trades fail-open for fail-closed. Deferred.

## Decision

1. **Keep ARP/NDP + nftables enforcement.** It is the right trade for a
   free box that a non-technical parent plugs in: zero network changes,
   fails open, covers every non-admin bypass in the spec's matrix.
2. **The product's promise is: "blocks normal use, and tells you when it's
   being dodged."** We do not promise airtight blocking. Out of scope,
   stated in the parent-facing setup copy and docs: static ARP / static
   gateway on the kid's device, cloning a parent's MAC, phone hotspots,
   cellular, flashing the router. A kid who can do those will beat any
   reasonable LAN mechanism; the parent conversation is the fix.
3. **Bidirectional ARP/NDP redirect, then detection for what's left.** The
   box spoofs both sides: it tells the device the gateway is at the box, and
   tells the gateway the device is at the box. A kid-side static ARP entry or
   static gateway is now *usually stopped*: even if the device talks straight to the
   router, the router still hands the device's return traffic to the box,
   which drops it. The box flags a blocked device `resisting` when it keeps
   receiving router→device traffic for it, meaning a bypass the gateway side
   didn't catch (e.g. a router with ARP inspection that rejects the
   gateway-side spoof, or an IPv6 path the box missed). The device record
   carries the flag and the parents get a notification in plain words.

   **Lab finding:** passively sniffing kid→router traffic is impossible on a
   switched LAN. A Linux bridge (like any switch or Wi-Fi AP) delivered zero
   kid→router unicast frames to the box's port, so the original "frames still
   reach the real gateway" detector could never fire. The box only reliably
   sees frames addressed to its own MAC. That is why we redirect the gateway
   too: the router's return traffic for a blocked device lands on the box,
   where it can be both dropped and counted.
4. **"Test block" diagnoses, not just reports.** The same sniff distinguishes
   "your router is blocking the box" (ARP takeover never observed) from
   "the device is ignoring the box" (takeover observed, traffic still
   reaches the router), so the parent gets an actionable sentence.
5. **A real network lab for dev and CI.** A compose profile builds a Linux
   bridge LAN with a router, fake internet, the real backend, the real
   blocker image, and kid containers. Integration tests exercise real ARP,
   real nftables, real captive portal, and the resistance detector. A
   packet simulator was rejected: it would re-implement kernel ARP behavior
   badly and prove nothing.
6. **Deferred to v3 (candidate, not committed):** optional DHCP mode for
   families whose router defeats ARP redirection. Only if the router
   compatibility list shows real demand, and only as an explicit "Advanced"
   opt-in with the fail-closed warning in the UI.

## Known limits

- A device that changes its address without announcing it can slip past until
  the box rediscovers it.
- A device can sometimes undo the box's redirect by answering the router
  directly.
- Unblocking can take up to about a minute to fully restore a device (being
  worked on).

## Consequences

- Positive: no new install steps, no new hardware, no cloud. Parents get
  honest, actionable messages instead of silent failures.
- Positive: enforcement regressions become CI failures.
- Negative: a motivated admin kid still wins; we say so up front.
- Negative: lab tests need Docker with `NET_ADMIN`; they run in a separate
  CI job and are skipped where Docker is unavailable.
- Follow-up: `docs/routers.md` compatibility list, seeded from "Test block"
  outcomes.
