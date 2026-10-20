# t@sk4ce v2.0 — Plan 2: Network blocker service

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A separate, host-networked service that discovers LAN devices, reports them to the app, and enforces the app's block decisions so a blocked device loses outside internet while keeping LAN access and seeing an "Internet is paused" page.

**Architecture:** One Python package `blocker/` run as its own container with `network_mode: host` and `NET_RAW`/`NET_ADMIN`. It is a thin executor: the app owns all policy (who is blocked). Three cooperating parts behind one asyncio process — a small HTTP API (`POST /state`, `GET /health`, `POST /test-block`), a discovery sweep that reports devices to the app, and an enforcer that redirects blocked devices' traffic to this box (ARP for IPv4, NDP for IPv6) and drops their internet-bound packets with `nftables`, serving a captive-portal DNS + HTTP redirect to the kid screen. Fails open: if the box stops, spoofing stops and ARP/NDP caches expire, so devices return online on their own.

**Tech Stack:** Python 3.11, scapy (L2 craft/sniff), `nftables` via `subprocess` (nft binary), stdlib `asyncio`/`http.server`/`socketserver` for the API, DNS and HTTP portal. No web framework (ponytail: the API is three routes). Reuses the app↔blocker contract already shipped in Plan 1.

**Spec:** `docs/superpowers/specs/2026-10-20-task4ce-v2-design.md` §4 (enforcement, bypass matrix, discovery, device model), §4.1a, §7.2, §8 (footprint <100 MB RAM on a Pi 4; Python+scapy is the chosen language), §9.5 (copy), §12.

## Global Constraints
- **The app owns policy.** The blocker never decides who is blocked; it applies the set the app pushes to `POST /state` and reconciles against `GET /api/v1/internal/state`. No chore/window/override logic here.
- **Contract is fixed by Plan 1** (`backend/app/lock/blocker_client.py`, `backend/app/api/internal.py`):
  - App → blocker: `POST {BLOCKER_URL}/state`, body `{"blocked": ["aa:bb:cc:dd:ee:ff", ...]}`, header `X-Internal-Token`. MACs are lowercase, colon-separated. 2xx = applied.
  - Blocker → app: `POST {BACKEND_URL}/api/v1/internal/devices/seen`, body `{"mac", "ip"?, "ipv6": [...]≤8, "hostname"?≤255, "vendor"?≤255}`, header `X-Internal-Token` → `{"id": int}`.
  - Blocker → app: `GET {BACKEND_URL}/api/v1/internal/state`, header `X-Internal-Token` → `{"blocked": [...]}` (used for periodic reconcile).
- **Shared secret:** `INTERNAL_TOKEN` comes from env, else from `{DATA_DIR}/secrets.json` key `INTERNAL_TOKEN` (written by the app's `backend/app/core/secrets.py`). Startup fails loudly if neither is set. All internal requests use `hmac.compare_digest` for token checks (match app's `require_token`).
- **Must block IPv4 and IPv6** from v2.0. **LAN stays reachable** while blocked (kid screen on `task4ce.local`). **Fails open** on crash/shutdown: restore ARP/NDP and flush this box's nft table.
- **Footprint:** target < 100 MB RAM idle on a Pi 4. One spoof task per blocked device, coalesced; no per-packet Python in the hot path for allowed traffic (kernel `nftables` does the forwarding/drop).
- **Copy:** plain words, no jargon in anything a parent sees ("device is offline", not "ARP spoof active").
- **Files < 500 lines.** Conventional commits ending with the attribution line this session's reminder specifies. CI green before commits (`ruff format --check`, `ruff check`, `pytest`).
- **No hardware in CI:** tests that send/receive real L2 frames or shell out to `nft` are marked `@pytest.mark.integration` and skipped by default; unit tests cover packet/ruleset/DNS construction and state logic with scapy objects and fakes.

## Review Focus
- **Malformed `/state` body** (missing `blocked`, non-list, non-MAC strings, duplicates, uppercase, >LAN device count): the blocker must reject with 400 and keep the previous set, never crash the enforcer. → Task 4 tests.
- **A blocked device with no known IP yet** (seen by MAC only, discovery hasn't learned its IP): it must stay in the pending set and get enforced as soon as an IP is learned, not silently skipped forever. → Task 6 tests.
- **App unreachable at startup or during run** (box boots before app, or app restarts): discovery reports retry with backoff and the last pushed `/state` set keeps being enforced; reconcile resumes when the app returns. → Task 5 + Task 8 tests.
- **Token missing or wrong on `/state` and `/test-block`**: 403, no state change, constant-time compare. → Task 4 tests.
- **Unclean shutdown / SIGTERM mid-block**: ARP/NDP restored for every target and nft table flushed, so devices are not left pointing at a dead box longer than cache TTL (fail-open is honored deliberately). → Task 8 tests.

---

### Task 1: Package scaffold, config, health API

**Files:**
- Create: `blocker/__init__.py`, `blocker/config.py`, `blocker/api.py`, `blocker/__main__.py`
- Test: `blocker/tests/test_config.py`, `blocker/tests/test_api.py`
- Create: `blocker/pyproject.toml` (deps: `scapy>=2.5`, dev: `pytest`, `ruff==0.17.1`), `blocker/README.md`

**Interfaces:**
- Produces: `Config.from_env(environ: Mapping) -> Config` with fields `backend_url: str`, `blocker_url_host: str`, `blocker_port: int` (default 7777), `internal_token: str`, `lan_iface: str`, `data_dir: Path`, `scan_interval: float` (default 20), `reconcile_interval: float` (default 30), `portal_redirect_url: str` (default `http://task4ce.local/kid`). Token resolution: env `INTERNAL_TOKEN`, else `{data_dir}/secrets.json["INTERNAL_TOKEN"]`; raise `RuntimeError` if empty.
- Produces: `make_api(state: "StateStore", token: str, tester: Callable) -> http.server.HTTPServer`-compatible app serving `GET /health` → 200 `{"ok": true}`; other routes filled in Task 4.

- [ ] **Step 1: Write failing test** — `test_from_env_reads_token_from_secrets_file` (writes a temp `secrets.json`, no env token, asserts `Config.from_env` returns it) and `test_from_env_env_overrides_file`; `test_missing_token_raises`.
- [ ] **Step 2: Run, verify fail** — `pytest blocker/tests/test_config.py -v` → ImportError/fail.
- [ ] **Step 3: Implement `Config` dataclass and `from_env`** in `blocker/config.py`. Read the secrets file with the same `O_NOFOLLOW` care as the app if present; plain `json.load` is acceptable here (read-only, root-owned volume).
- [ ] **Step 4: Write failing test** — `test_health_ok` using `http.client` against the server on an ephemeral port in a thread.
- [ ] **Step 5: Implement `make_api`** in `blocker/api.py` with a `BaseHTTPRequestHandler`; `__main__.py` wires config + a placeholder state store and runs the server.
- [ ] **Step 6: Run both test files, verify pass.**
- [ ] **Step 7: Commit** — `feat(blocker): package scaffold, config and health endpoint`.

---

### Task 2: Device identity (vendor + name)

**Files:**
- Create: `blocker/identity.py`, `blocker/data/oui.csv` (small bundled prefix→vendor table; documented as a trimmed IEEE OUI subset, extendable)
- Test: `blocker/tests/test_identity.py`

**Interfaces:**
- Produces: `vendor_for(mac: str) -> str | None` (first 3 octets → vendor, case-insensitive, unknown → None); `friendly_name(hostname: str | None, vendor: str | None) -> str` (hostname if present, else `f"{vendor} device"`, else `"Unknown device"`, ≤100 chars).

- [ ] **Step 1: Write failing tests** — known prefix → vendor; unknown → None; `friendly_name` precedence and the 100-char clamp.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — load `oui.csv` once at import into a dict keyed by normalized 6-hex prefix.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(blocker): MAC vendor lookup and friendly device names`.

---

### Task 3: Backend client (report + reconcile)

**Files:**
- Create: `blocker/backend.py`
- Test: `blocker/tests/test_backend.py`

**Interfaces:**
- Consumes: `Config` (Task 1).
- Produces: `report_seen(cfg, seen: Seen) -> int | None` (POST `/devices/seen`; returns device id, None on failure, never raises); `fetch_blocked(cfg) -> list[str] | None` (GET `/state`; None on failure). `Seen` is a dataclass `{mac, ip, ipv6, hostname, vendor}`. Uses stdlib `urllib.request` with a 5 s timeout (no new dep; httpx not needed for two calls). Sends `X-Internal-Token`.

- [ ] **Step 1: Write failing tests** — with a stub HTTP server (threaded `HTTPServer`): `test_report_seen_sends_token_and_body` (assert header + JSON shape, returns id), `test_report_seen_returns_none_on_5xx`, `test_fetch_blocked_parses_list`, `test_fetch_blocked_none_on_timeout`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** both functions; wrap all network/parse errors → None and log a warning.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(blocker): backend client for device reports and state reconcile`.

---

### Task 4: State store + `/state` and `/test-block` API

**Files:**
- Create: `blocker/state_store.py`
- Modify: `blocker/api.py` (fill `POST /state`, `POST /test-block`)
- Test: `blocker/tests/test_state_store.py`, extend `blocker/tests/test_api.py`

**Interfaces:**
- Produces: `StateStore` holding the authoritative `blocked: set[str]` (lowercase MACs) behind a `threading.Lock`. Methods: `set_blocked(macs: list[str]) -> set[str]` (validate each MAC against the app's `MAC_RE`; dedupe/lowercase; raise `ValueError` on any bad entry, leaving the old set intact; return the new set), `current() -> set[str]`, `on_change(cb: Callable[[set[str]], None])` (enforcer subscribes in Task 6).
- Produces (api): `POST /state` → 200 `{"ok": true, "count": n}` on success, 400 `{"error": "..."}` on bad body (plain-language message), 403 on bad token. `POST /test-block` body `{"mac"}` → calls the injected `tester(mac)` and returns `{"offline": bool, "router_resisted": bool, "message": str}` (tester implemented in Task 8; a stub returns a fixed result for the API test).

- [ ] **Step 1: Write failing tests (store)** — `test_set_blocked_normalizes_and_dedupes`, `test_set_blocked_rejects_bad_mac_keeps_old`, `test_on_change_fires_with_new_set`.
- [ ] **Step 2: Write failing tests (api)** — `test_state_requires_token` (403), `test_state_rejects_non_list` and `test_state_rejects_bad_mac` (400, set unchanged), `test_state_applies_and_reports_count`.
- [ ] **Step 3: Run, verify fail.**
- [ ] **Step 4: Implement** `StateStore` and the two routes; reuse a `MAC_RE` copied from `internal.py` (keep identical).
- [ ] **Step 5: Run, verify pass.**
- [ ] **Step 6: Commit** — `feat(blocker): authoritative state store and /state, /test-block API`.

---

### Task 5: Discovery sweep

**Files:**
- Create: `blocker/discovery.py`
- Test: `blocker/tests/test_discovery.py`

**Interfaces:**
- Consumes: `Config`, `vendor_for`/`friendly_name` (Task 2), `report_seen` (Task 3).
- Produces: `scan_once(cfg, send=srp, resolve=resolve_hostname) -> list[Seen]` — ARP-sweep the LAN (`send` injectable so tests pass a fake returning crafted `(sent, received)` scapy pairs), build `Seen` per responder (MAC, IPv4, hostname via injected `resolve`, vendor via Task 2), and call `report_seen` for each. IPv6 neighbors via NDP are gathered the same way and merged by MAC. `run_discovery(cfg, stop: threading.Event)` loops `scan_once` every `scan_interval` with jitter.
- Produces: `resolve_hostname(ip) -> str | None` (reverse DNS + mDNS best-effort, injectable, never raises).

- [ ] **Step 1: Write failing tests** — `test_scan_once_builds_seen_from_arp_replies` (fake `send` returns two replies; assert two `Seen` with correct mac/ip/vendor), `test_scan_once_reports_each` (fake `report_seen` records calls), `test_scan_merges_ipv6_by_mac`, `test_resolve_hostname_never_raises`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** using scapy `Ether/ARP` and `IPv6/ICMPv6ND_NS`; real send path uses `scapy.sendrecv.srp` but is only hit in an `@integration` test.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(blocker): LAN discovery sweep with device reporting`.

---

### Task 6: Enforcement — spoofers + nftables

**Files:**
- Create: `blocker/arp.py` (ARP + NDP packet builders and per-target spoof loop), `blocker/firewall.py` (nftables ruleset manager)
- Test: `blocker/tests/test_arp.py`, `blocker/tests/test_firewall.py`

**Interfaces:**
- Consumes: `Config`, LAN facts (gateway IPv4/IPv6, box MAC — gathered by injectable helpers so tests don't touch the kernel).
- Produces (arp): `arp_reply(target_ip, target_mac, gateway_ip, box_mac) -> scapy.Packet` and `ndp_advert(target_ip6, target_mac, gateway_ip6, box_mac) -> scapy.Packet` (assert fields in tests); `restore(target) -> list[Packet]` (correct mappings to heal caches); `Spoofer(cfg).set_targets(targets: dict[mac, TargetAddrs])` starts/stops one re-send loop per target (default 2 s cadence), heals on removal. A blocked MAC with no known IP is kept pending and activated when `set_targets` later includes its address.
- Produces (firewall): `render_ruleset(blocked_v4: set[str], blocked_v6: set[str], lan_cidrs, portal_ip, portal_port) -> str` (pure; builds the `table inet task4ce` text: forward chain drops blocked src → non-LAN, accepts → LAN; redirects blocked src tcp:80→portal and udp/tcp:53→portal, drops blocked src tcp:443). `apply(ruleset: str)` and `flush()` shell out to `nft -f -` (only in `@integration` tests). `enable_forwarding()` sets the two sysctls.

- [ ] **Step 1: Write failing tests (arp)** — `test_arp_reply_fields` (op=2, psrc=gateway, hwsrc=box, pdst/hwdst=target), `test_ndp_advert_fields`, `test_set_targets_starts_and_stops_loops` (fake sender records targets), `test_restore_sends_truth`, `test_pending_target_without_ip_activates_on_update`.
- [ ] **Step 2: Write failing tests (firewall)** — `test_render_blocks_v4_and_v6_to_wan_allows_lan`, `test_render_redirects_dns_and_http_drops_https`, `test_render_empty_set_is_noop_safe`.
- [ ] **Step 3: Run, verify fail.**
- [ ] **Step 4: Implement** both modules. Spoof loop uses injected `send` (real: `scapy.sendp`).
- [ ] **Step 5: Run, verify pass.**
- [ ] **Step 6: Commit** — `feat(blocker): ARP/NDP spoofers and nftables enforcement`.

---

### Task 7: Captive portal (DNS + HTTP)

**Files:**
- Create: `blocker/portal.py`
- Test: `blocker/tests/test_portal.py`

**Interfaces:**
- Produces: `dns_response(query_wire: bytes, answer_ip: str) -> bytes` (pure; any A query → `answer_ip`, AAAA → the box IPv6 or empty NOERROR; preserves id/question). `run_dns(cfg, box_ip, stop)` serves it on UDP :53 (only `@integration`). `PortalHTTP` handler: any request → `302` to `cfg.portal_redirect_url`; serves OS captive-check paths (`captive.apple.com`, `connectivitycheck.gstatic.com`, `msftconnecttest.com`) with the redirect so the kid screen pops up. `run_http(cfg, stop)` on :80.

- [ ] **Step 1: Write failing tests** — `test_dns_response_answers_a_with_box_ip` (parse the built packet, assert answer + preserved id), `test_dns_response_aaaa_noerror_no_answer`, `test_portal_http_redirects_to_kid_screen` (feed a GET through the handler, assert 302 + Location).
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** using scapy `DNS`/`DNSRR` for wire build and a `BaseHTTPRequestHandler` for HTTP.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(blocker): captive-portal DNS and HTTP redirect to kid screen`.

---

### Task 8: Orchestrator — wire loop, test-block, fail-open shutdown

**Files:**
- Create: `blocker/service.py`
- Modify: `blocker/__main__.py` (run the service), `blocker/api.py` (inject the real tester)
- Test: `blocker/tests/test_service.py`

**Interfaces:**
- Consumes: everything above.
- Produces: `Service(cfg)` that on start: enables forwarding, starts discovery, API, portal, and subscribes the enforcer to `StateStore.on_change` (recompute v4/v6 sets from currently-known device IPs, `firewall.apply`, `spoofer.set_targets`). A `reconcile` task polls `fetch_blocked` every `reconcile_interval` and feeds it through the same `set_blocked` path (push stays primary; poll heals missed pushes). `test_block(mac) -> dict` blocks one MAC, waits briefly, probes reachability via an injected `probe(ip) -> bool`, returns `{offline, router_resisted, message}` with plain copy, then restores prior state. `stop()` restores every spoof target and calls `firewall.flush()` (fail open) even on exception.
- Produces: `main()` installs SIGTERM/SIGINT → `stop()`.

- [ ] **Step 1: Write failing tests** (fakes for firewall/spoofer/backend/probe): `test_on_change_recomputes_and_applies` (set blocked → firewall.apply called with that device's IPs, spoofer targets set), `test_blocked_mac_without_ip_is_pending_then_enforced_when_seen`, `test_reconcile_applies_fetched_set`, `test_reconcile_keeps_last_set_when_app_unreachable`, `test_test_block_reports_router_resisted_when_still_online`, `test_stop_restores_and_flushes_even_on_error`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `Service`; keep policy-free (only maps MAC↔known-IP and applies).
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Run the whole suite** — `pytest blocker/tests -q` (unit only; integration deselected) and `ruff check blocker && ruff format --check blocker`.
- [ ] **Step 6: Commit** — `feat(blocker): service orchestrator with reconcile, test-block and fail-open shutdown`.

---

### Task 9: Container + compose + docs

**Files:**
- Create: `blocker/Dockerfile` (python:3.11-slim base, install `nftables` + `libpcap`, non-root not possible — needs NET_ADMIN/NET_RAW, so run as root in host net with only those caps; document why), `blocker/.dockerignore`
- Modify: `docker-compose.yml` (add `blocker` service: `network_mode: host`, `cap_add: [NET_ADMIN, NET_RAW]`, read-only mount of the data volume for the secret, env `BACKEND_URL`, `LAN_IFACE`), `backend/app/core/config.py` only if `BLOCKER_URL` must change (it should stay `http://127.0.0.1:7777` for host-net)
- Create: `docs/blocker.md` (what it does in plain words, the bypass matrix from §4.1a, router-compatibility note, "place the box out of reach", fail-open behavior)
- Test: `blocker/tests/test_compose.py` (parse `docker-compose.yml`, assert the blocker service has host networking and the two caps and no others)

**Interfaces:**
- Consumes: the full package.

- [ ] **Step 1: Write failing test** — `test_blocker_service_has_host_net_and_minimal_caps` (load compose YAML, assert `network_mode == 'host'`, `cap_add` sorted == `['NET_ADMIN','NET_RAW']`, no `privileged: true`).
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Write `Dockerfile`, add the compose service, write `docs/blocker.md`.**
- [ ] **Step 4: Run, verify pass**; `docker compose config` parses (integration/local only).
- [ ] **Step 5: Commit** — `feat(blocker): container, compose service and beginner docs`.

---

## Self-review notes
- **Spec coverage:** §4.1 mechanism → T6; §4.1a bypass matrix → T6 (drop-not-DNS) + T9 docs; §4.2 discovery/quarantine → T5 reports, quarantine itself is the app's default (`internal.py` creates new devices `status="unassigned"`, already blocked by the rule engine); §4.1 test-block → T4/T8; captive portal → T7; §7.2 compose two services host-net → T9; §8 footprint/one-language → Python+scapy, kernel does forwarding; §9.5 copy → T4/T7/T8 messages, T9 docs. Fail-open (§4.1) → T8.
- **Not in scope (app already does it):** block/unblock decisions, new-device quarantine state, "box offline" parent alert (§10, heartbeat — app/PWA concern, deferred to v2.2 per spec).
- **Contract names checked** against `blocker_client.py`/`internal.py`: `/state` body key `blocked`, `/devices/seen` field names and limits, `X-Internal-Token`, lowercase colon MACs, `BLOCKER_URL` 7777.
