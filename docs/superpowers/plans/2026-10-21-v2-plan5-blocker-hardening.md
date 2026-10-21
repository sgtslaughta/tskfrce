# Blocker Hardening & Network Lab Implementation Plan (v2 Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The box tells parents when a blocked device is getting around the block, "Test block" says *why* a block failed, the product states its honest ceiling, and a Docker network lab proves enforcement end-to-end in dev and CI.

**Architecture:** One new blocker module (`resist.py`) sniffs frames from blocked MACs and counts those that still reach the real gateway versus those that reach the box; the service pushes the resisting set to a new internal backend endpoint, the backend stamps `Device.resisting_since` and notifies parents once per episode, and the same counters give "Test block" its diagnosis. A compose lab (`lab/`) builds a Linux bridge LAN with router, fake internet, real backend, real blocker image and kid containers; `scripts/lab.sh` drives it and pytest integration tests shell that script.

**Tech Stack:** Python 3.11, scapy `AsyncSniffer`, stdlib, FastAPI + SQLAlchemy + Alembic (backend), Docker Compose (bridge networks, `cap_add`, `sysctls`, `mac_address`), Alpine + curl/busybox for lab hosts, nginx:alpine as fake internet, bash, pytest `integration` marker, GitHub Actions.

**Spec:** `docs/adr/0001-blocker-enforcement-vs-firewalla.md` (decisions 2–5) refining `docs/superpowers/specs/2026-10-20-task4ce-v2-design.md` §4, §4.1a, §10.

**Branch:** `feat/v2-hardening`, cut from `main` **after** `feat/v2-blocker` (Plan 2) merges. Repo root for all paths below is the repo (`blocker/`, `backend/`, `frontend/`, `lab/`, `scripts/`, `docs/`).

## Global Constraints

- Files under 500 lines; split when touched.
- Parent-facing copy: plain words, no jargon ("getting around the block", never "ARP").
- Blocker: no new dependencies beyond scapy; no per-packet Python for *allowed* traffic from non-blocked devices (sniffer BPF filter limits capture to watched MACs).
- Blocker fails open; the detector never changes enforcement, only reports.
- Backend internal endpoints use `X-Internal-Token` via `require_token` (`backend/app/api/internal.py`).
- Blocker footprint target < 100 MB RAM idle on Pi 4.
- No hardware in unit CI: anything touching real frames, `nft`, or Docker is `@pytest.mark.integration` and skipped by default.
- Semantic commits; `ruff` clean (`backend` and `blocker` configs in `pyproject.toml`); frontend `npm run lint` and `npm test` green.

## Review Focus

1. A blocked device that is simply idle must never be flagged resisting (zero frames in window ⇒ not resisting). Pinned in Task 1.
2. The blocker restarts while a device is mid-episode: the backend must not re-notify parents for an episode it already announced. Pinned in Task 3 (`resisting_since` set ⇒ no second notification).
3. A device unblocked by the app must have its flag cleared even though the blocker no longer watches it (blocker sends the full resisting set each push; absent ⇒ cleared). Pinned in Task 3.
4. Gateway MAC unknown (`LanFacts.gateway_mac is None`): detector must not crash and must report nothing rather than guess. Pinned in Task 1.
5. Lab host without Docker or without IPv6 on bridges: tests skip / xfail cleanly, never error the suite. Pinned in Task 8.

---

### Task 1: Resistance counters (pure logic)

**Files:**
- Create: `blocker/resist.py`
- Test: `blocker/tests/test_resist.py`

**Interfaces:**
- Consumes: `blocker.arp.LanFacts` (fields `gateway_mac`, `gateway_mac6`, `box_mac`).
- Produces:
  ```python
  @dataclass
  class Tally:            # per watched MAC, within the current window
      to_gateway: int = 0
      to_box: int = 0

  class ResistanceCounter:
      def __init__(self, lan: LanFacts, *, window: float = 30.0, threshold: int = 20, clock: Callable[[], float] = time.monotonic) -> None
      def set_watched(self, macs: set[str]) -> None          # replaces the watched set; drops tallies of removed MACs
      def observe(self, src_mac: str, dst_mac: str, now: float | None = None) -> None   # ignores unwatched src
      def tally(self, mac: str) -> Tally                       # current-window counts (zeros if unwatched)
      def resisting(self) -> set[str]                          # macs whose to_gateway >= threshold in window
  ```
  Window semantics: a MAC's tally resets when `now - window_start >= window`. `dst_mac` compared lowercase against `lan.gateway_mac` and `lan.gateway_mac6` (both may be `None`) and `lan.box_mac`.

- [ ] **Step 1: Write the failing tests**

```python
from blocker.arp import LanFacts
from blocker.resist import ResistanceCounter

LAN = LanFacts(gateway_ip="10.0.0.1", gateway_mac="aa:aa:aa:aa:aa:01", box_mac="bb:bb:bb:bb:bb:02")
KID = "cc:cc:cc:cc:cc:03"

def _counter(**kw):
    t = [100.0]
    c = ResistanceCounter(LAN, threshold=3, window=30, clock=lambda: t[0], **kw)
    c.set_watched({KID})
    return c, t

def test_idle_device_is_not_resisting():
    c, _ = _counter()
    assert c.resisting() == set()

def test_frames_to_gateway_reach_threshold():
    c, _ = _counter()
    for _ in range(3):
        c.observe(KID, LAN.gateway_mac)
    assert c.resisting() == {KID}
    assert c.tally(KID).to_gateway == 3

def test_frames_to_box_do_not_count_as_resisting():
    c, _ = _counter()
    for _ in range(5):
        c.observe(KID, LAN.box_mac)
    assert c.resisting() == set()
    assert c.tally(KID).to_box == 5

def test_window_resets_counts():
    c, t = _counter()
    c.observe(KID, LAN.gateway_mac); c.observe(KID, LAN.gateway_mac)
    t[0] += 31
    c.observe(KID, LAN.gateway_mac)
    assert c.tally(KID).to_gateway == 1

def test_unwatched_src_ignored_and_unwatch_drops_tally():
    c, _ = _counter()
    c.observe("dd:dd:dd:dd:dd:04", LAN.gateway_mac)
    assert c.tally("dd:dd:dd:dd:dd:04").to_gateway == 0
    c.observe(KID, LAN.gateway_mac)
    c.set_watched(set())
    assert c.tally(KID).to_gateway == 0

def test_unknown_gateway_mac_never_flags():
    lan = LanFacts(gateway_ip="10.0.0.1", gateway_mac=None, box_mac=LAN.box_mac)
    c = ResistanceCounter(lan, threshold=1)
    c.set_watched({KID})
    c.observe(KID, "aa:aa:aa:aa:aa:01")
    assert c.resisting() == set()

def test_mac_case_insensitive():
    c, _ = _counter()
    for _ in range(3):
        c.observe(KID.upper(), LAN.gateway_mac.upper())
    assert c.resisting() == {KID}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd blocker && python -m pytest tests/test_resist.py -v`
Expected: FAIL `ModuleNotFoundError: blocker.resist`

- [ ] **Step 3: Implement `blocker/resist.py`** with `Tally` and `ResistanceCounter` per the Interfaces block. Internal state: `dict[str, tuple[float, Tally]]` of `(window_start, tally)` guarded by one `threading.Lock` (the sniffer thread calls `observe`).

- [ ] **Step 4: Run to verify pass**

Run: `cd blocker && python -m pytest tests/test_resist.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add blocker/resist.py blocker/tests/test_resist.py
git commit -m "feat(blocker): resistance counters for blocked devices"
```

---

### Task 2: Sniffer wiring and service integration

**Files:**
- Modify: `blocker/resist.py` (add `ResistanceWatch`)
- Modify: `blocker/service.py` (`Service.__init__`, `_apply`, `start`, `stop`)
- Modify: `blocker/backend.py` (add `report_resisting`)
- Modify: `blocker/config.py` (add `resist_interval`)
- Test: `blocker/tests/test_resist.py`, `blocker/tests/test_service.py`, `blocker/tests/test_backend.py`, `blocker/tests/test_config.py`

**Interfaces:**
- Consumes: Task 1 `ResistanceCounter`; `RedirectionManager._lanfacts()` (`blocker/arp.py:187`); `Service._apply` lock pattern.
- Produces:
  ```python
  # blocker/resist.py
  class ResistanceWatch:
      """Runs a scapy AsyncSniffer on cfg.lan_iface feeding a ResistanceCounter."""
      def __init__(self, cfg, counter: ResistanceCounter, *, sniffer_factory: Callable[..., Any] = _real_sniffer) -> None
      def set_watched(self, macs: set[str]) -> None   # restarts sniffer with filter "ether src <m1> or ether src <m2> ..." ; stops it when empty
      def stop(self) -> None
      counter: ResistanceCounter
  def _real_sniffer(*, iface: str | None, filter: str, prn: Callable) -> Any   # returns scapy AsyncSniffer, started

  # blocker/backend.py
  def report_resisting(cfg: Config, macs: set[str]) -> bool   # POST {backend}/api/v1/internal/devices/resisting  {"resisting": sorted(macs)}; never raises

  # blocker/config.py
  Config.resist_interval: float   # env RESIST_INTERVAL, default 15
  ```
  Service: `Service.__init__` gains kwargs `watch: ResistanceWatch | None = None` and `report: Callable[[Config, set[str]], bool] = report_resisting`. `_apply` calls `self._watch.set_watched(macs)` after `set_targets`. `start` spawns `_resist_loop` which every `cfg.resist_interval` seconds calls `report(cfg, watch.counter.resisting())` **always** (full set, possibly empty, so the backend can clear). `stop` calls `watch.stop()`.
  `prn` callback: `counter.observe(pkt.src, pkt.dst)` for packets having an `Ether` layer.

- [ ] **Step 1: Write the failing tests**

In `blocker/tests/test_resist.py` add:
```python
def test_watch_restarts_sniffer_with_mac_filter():
    calls = []
    class FakeSniffer:
        def __init__(self, **kw): calls.append(kw); self.stopped = False
        def stop(self): self.stopped = True
    counter = ResistanceCounter(LAN)
    w = ResistanceWatch(SimpleNamespace(lan_iface="eth0"), counter, sniffer_factory=lambda **kw: FakeSniffer(**kw))
    w.set_watched({KID, "dd:dd:dd:dd:dd:04"})
    assert calls[-1]["iface"] == "eth0"
    assert calls[-1]["filter"] == f"ether src {KID} or ether src dd:dd:dd:dd:dd:04"
    w.set_watched(set())
    assert w._sniffer is None

def test_watch_prn_feeds_counter():
    from scapy.layers.l2 import Ether
    captured = {}
    counter = ResistanceCounter(LAN, threshold=1)
    w = ResistanceWatch(SimpleNamespace(lan_iface=""), counter, sniffer_factory=lambda **kw: captured.update(kw) or SimpleNamespace(stop=lambda: None))
    w.set_watched({KID})
    captured["prn"](Ether(src=KID, dst=LAN.gateway_mac))
    assert counter.resisting() == {KID}
```
In `blocker/tests/test_backend.py` add `test_report_resisting_posts_sorted_list` asserting the request path is `/api/v1/internal/devices/resisting`, body `{"resisting": ["aa:…", "bb:…"]}`, header `X-Internal-Token`, and that a connection error returns `False` (mirror the existing `report_seen` test's fake transport).
In `blocker/tests/test_service.py` add:
```python
def test_apply_updates_watch_and_loop_reports_full_set():
    # build Service with fake firewall/redirection as existing tests do, plus:
    watch = SimpleNamespace(set_watched=Mock(), stop=Mock(), counter=Mock(resisting=Mock(return_value={"aa:aa:aa:aa:aa:01"})))
    reports = []
    svc = Service(cfg, firewall=fake_fw, redirection=fake_redir, watch=watch, report=lambda c, m: reports.append(m) or True, sleep=lambda s: None)
    svc.store.set_blocked(["aa:aa:aa:aa:aa:01"])
    watch.set_watched.assert_called_with({"aa:aa:aa:aa:aa:01"})
    svc._resist_once()
    assert reports == [{"aa:aa:aa:aa:aa:01"}]
    watch.counter.resisting.return_value = set()
    svc._resist_once()
    assert reports[-1] == set()
```
In `blocker/tests/test_config.py` add `test_resist_interval_default_15_and_env`.

- [ ] **Step 2: Run to verify fail**

Run: `cd blocker && python -m pytest tests/test_resist.py tests/test_service.py tests/test_backend.py tests/test_config.py -v`
Expected: new tests FAIL (ImportError / TypeError on unknown kwargs)

- [ ] **Step 3: Implement** `ResistanceWatch`, `_real_sniffer` (scapy `AsyncSniffer(iface=iface or None, filter=filter, prn=prn, store=False)`, `.start()`), `report_resisting`, `Config.resist_interval`, and the `Service` changes including `_resist_once()` and `_resist_loop()` (same shape as `_reconcile_loop`). Default `watch` in `Service.__init__`: `ResistanceWatch(cfg, ResistanceCounter(self._redir._lanfacts()))` **lazily in `start()`** (LAN detection needs the kernel; tests pass a fake).

- [ ] **Step 4: Run full blocker suite + lint**

Run: `cd blocker && python -m pytest -q && ruff check . && ruff format --check .`
Expected: all pass, 0 lint errors

- [ ] **Step 5: Commit**

```bash
git add blocker/
git commit -m "feat(blocker): sniff blocked devices and report resisting set"
```

---

### Task 3: Backend `resisting` endpoint, column, parent notification

**Files:**
- Create: `backend/alembic/versions/<rev>_device_resisting_since.py`
- Modify: `backend/app/models/lock.py:34-49` (add `resisting_since = Column(DateTime, nullable=True)`)
- Modify: `backend/app/api/internal.py` (add route)
- Modify: `backend/app/api/devices.py:23-46` (`device_out` adds `"resisting": d.resisting_since is not None`)
- Test: `backend/tests/test_internal_resisting.py`, extend `backend/tests/test_devices.py` (or wherever `device_out` is tested)

**Interfaces:**
- Consumes: `require_token`, `MAC_RE`, `Device`, `NotificationPersistenceService.create_notification(user_id, notification_type, title, message, action_url, data)`, `User.role == UserRole.PARENT`.
- Produces: `POST /api/v1/internal/devices/resisting` body `{"resisting": [mac, ...]}` → `{"flagged": int, "cleared": int}`.
  Semantics: for each listed MAC with a `Device` row, if `resisting_since is None` set it to now and create one notification **per parent** with `notification_type="device_resisting"`, `title="{device.name} is getting around the block"`, `message="{device.name} is still reaching the internet while it should be paused. Someone may have changed its network settings. Tap for what to check."`, `action_url="/manage/devices"`, `data={"device_id": id}`. For each device **not** listed whose `resisting_since` is set, clear it to `None` (no notification). Unknown MACs ignored. Response counts transitions only.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_internal_resisting.py  (use the client/token/db fixtures test_internal.py already uses)
def test_flag_sets_since_and_notifies_each_parent_once(client, token, db, two_parents, device):
    r = client.post("/api/v1/internal/devices/resisting", json={"resisting": [device.mac]}, headers=token)
    assert r.status_code == 200 and r.json() == {"flagged": 1, "cleared": 0}
    db.refresh(device); assert device.resisting_since is not None
    assert db.query(Notification).filter_by(notification_type="device_resisting").count() == 2
    r = client.post("/api/v1/internal/devices/resisting", json={"resisting": [device.mac]}, headers=token)
    assert r.json() == {"flagged": 0, "cleared": 0}
    assert db.query(Notification).filter_by(notification_type="device_resisting").count() == 2

def test_absent_mac_clears_flag(client, token, db, device):
    client.post(..., json={"resisting": [device.mac]}, headers=token)
    r = client.post(..., json={"resisting": []}, headers=token)
    assert r.json() == {"flagged": 0, "cleared": 1}
    db.refresh(device); assert device.resisting_since is None

def test_unknown_mac_ignored_and_bad_token_403(client, token, db):
    assert client.post(..., json={"resisting": ["aa:bb:cc:dd:ee:ff"]}, headers=token).json() == {"flagged": 0, "cleared": 0}
    assert client.post(..., json={"resisting": []}).status_code == 403

def test_device_out_includes_resisting(...):
    assert device_out(db, device, fam, now)["resisting"] is False
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && python -m pytest tests/test_internal_resisting.py -v`
Expected: FAIL 404 / AttributeError `resisting_since`

- [ ] **Step 3: Implement** the column, the alembic migration (`alembic revision -m "device resisting_since"`, `op.add_column("devices", sa.Column("resisting_since", sa.DateTime(), nullable=True))`), the route in `internal.py` as `resisting(body: ResistingReport, db)` with `class ResistingReport(BaseModel): resisting: list[str]` reusing the `SeenReport` MAC validator, and the `device_out` key.

- [ ] **Step 4: Run backend suite + lint**

Run: `cd backend && python -m pytest -q && ruff check . && ruff format --check .`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): flag resisting devices and notify parents"
```

---

### Task 4: "Test block" diagnoses why

**Files:**
- Modify: `blocker/service.py:131-154` (`test_block`)
- Modify: `backend/app/lock/blocker_client.py` (add `test_block(mac) -> dict | None`)
- Modify: `backend/app/api/devices.py` (add `POST /devices/{device_id}/test-block`)
- Test: `blocker/tests/test_service.py`, `backend/tests/test_devices_test_block.py`

**Interfaces:**
- Consumes: Task 2 `watch.counter.tally(mac)`; `PROBE_WAIT`.
- Produces: blocker `POST /test-block` response gains `"reason": "ok" | "unseen" | "router" | "device"` with messages:
  - `ok`: `"Success — the device lost internet access while blocked."`
  - `unseen`: `"We haven't seen this device on the network yet, so we couldn't test it."`
  - `router`: `"The device stayed online and never talked to the box. Your router is probably stopping the box from stepping in — check the router list in the docs."`
  - `device`: `"The device stayed online even though it was talking to the box. It looks like the device itself is getting around the block — someone may have changed its network settings."`
  Rule: `online and tally.to_box == 0 → router`; `online and tally.to_box > 0 → device`. `router_resisted` key kept (`reason == "router"`) for compatibility.
  Backend: `blocker_client.test_block(mac: str) -> dict | None` (POST `{BLOCKER_URL}/test-block`, timeout 20, `None` on failure). Route `POST /api/v1/devices/{device_id}/test-block` (parent-only like the other device routes) → the blocker dict, or `503 {"detail": "The home box didn't answer. Is it plugged in?"}` when `None`.

- [ ] **Step 1: Write the failing tests**

Blocker (`test_service.py`): parametrize `(online, to_box) → reason` over `(False, 0, "ok")`, `(True, 0, "router")`, `(True, 4, "device")`; plus `ip is None → "unseen"`. Watch fake exposes `counter.tally` returning `Tally(to_gateway=..., to_box=...)`.
Backend (`test_devices_test_block.py`): monkeypatch `blocker_client.test_block` to return `{"reason": "device", "offline": False, "router_resisted": False, "message": "x"}` and assert passthrough; return `None` and assert `503` with the exact detail; kid user gets `403`.

- [ ] **Step 2: Run to verify fail**

Run: `cd blocker && python -m pytest tests/test_service.py -k test_block -v; cd ../backend && python -m pytest tests/test_devices_test_block.py -v`
Expected: FAIL (KeyError `reason` / 404)

- [ ] **Step 3: Implement** both sides per Interfaces. In `test_block`, read `tally` **after** `self._sleep(PROBE_WAIT)` and before restoring prior state.

- [ ] **Step 4: Run both suites + lint**

Run: `cd blocker && python -m pytest -q && ruff check .; cd ../backend && python -m pytest -q && ruff check .`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add blocker/service.py blocker/tests/test_service.py backend/app/lock/blocker_client.py backend/app/api/devices.py backend/tests/test_devices_test_block.py
git commit -m "feat: test block explains router vs device resistance"
```

---

### Task 5: Frontend: resisting badge, Test block button, honest promise copy

**Files:**
- Modify: `frontend/src/v2/types.ts` (`Device.resisting: boolean`)
- Modify: `frontend/src/v2/hooks/useDevices.ts` (add `useTestBlock`)
- Modify: `frontend/src/v2/manage/DeviceRow.tsx`
- Modify: `frontend/src/v2/manage/DevicesPage.tsx` (promise copy block)
- Test: `frontend/tests/v2/manage.test.tsx`

**Interfaces:**
- Consumes: Task 3 `resisting` field; Task 4 `POST /devices/{id}/test-block` → `{reason, message}`.
- Produces:
  - `useTestBlock = () => useMutation({ mutationFn: (id: number) => api<{reason: string; message: string}>(`/devices/${id}/test-block`, { method: 'POST' }) })`
  - `DeviceRow`: when `device.resisting`, a pill `<span className="f-pill" data-resisting>getting around the block</span>` next to the online pill. A `Button` "Test block" that calls the mutation and shows `toasts.info(message)` (or `toasts.error` when `reason !== 'ok'`); disabled with text "Testing…" while pending.
  - `DevicesPage`: one `<Text className="f-note">` under the heading with exact copy:
    > "The home box pauses internet for normal use on your Wi‑Fi. It can't stop a determined kid who changes network settings, uses a phone hotspot, or swaps devices — but it will tell you when a paused device is getting around the block."

- [ ] **Step 1: Write the failing tests** in `manage.test.tsx` `describe('devices')`: `shows resisting pill when device.resisting`, `hides pill otherwise`, `Test block button posts and toasts message` (mock `api` as other tests in the file do), and in a `describe('devices page')`: `renders the honest promise note` asserting the substring "getting around the block".

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx jest tests/v2/manage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement** per Interfaces.

- [ ] **Step 4: Run frontend tests + lint**

Run: `cd frontend && npm test -- --silent && npm run lint`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): resisting badge, test block button, honest promise copy"
```

---

### Task 6: Network lab compose + hosts

**Files:**
- Create: `lab/docker-compose.lab.yml`
- Create: `lab/router/Dockerfile`, `lab/router/entrypoint.sh`
- Create: `lab/host/Dockerfile`, `lab/host/entrypoint.sh` (used by kid1, kid2, parent)
- Create: `lab/fake-internet/index.html`
- Create: `lab/README.md`
- Test: `blocker/tests/test_lab_compose.py` (static YAML assertions, unit-level)

**Interfaces:**
- Produces: fixed topology every later task relies on.

| Service | Image | Networks / IP | MAC | Caps / sysctls | Notes |
|---|---|---|---|---|---|
| `fake-internet` | `nginx:alpine` | `wan` 10.99.1.1 / fd00:99:1::1 | — | NET_ADMIN | entrypoint adds `ip route add 10.99.0.0/24 via 10.99.1.2` and `ip -6 route add fd00:99::/64 via fd00:99:1::2`; serves `lab/fake-internet/index.html` ("fake internet") |
| `router` | `lab/router` (alpine + iproute2) | `lab` 10.99.0.2 / fd00:99::2, `wan` 10.99.1.2 / fd00:99:1::2 | `02:99:00:00:00:02` | NET_ADMIN; `net.ipv4.ip_forward=1`, `net.ipv6.conf.all.forwarding=1` | entrypoint: `sleep infinity` |
| `backend` | `extends: {file: ../docker-compose.yml, service: backend}` | `lab` 10.99.0.3 | — | — | env `INTERNAL_TOKEN=labtoken`, `BLOCKER_URL=http://10.99.0.4:7777`, `TRUSTED_HOSTS=*`, `DISABLE_RATE_LIMITING=true`; **no** `ports`, anonymous data volume |
| `blocker` | `build: ../blocker` | `lab` 10.99.0.4 / fd00:99::4 | `02:99:00:00:00:04` | NET_ADMIN, NET_RAW; `net.ipv4.ip_forward=1`, `net.ipv6.conf.all.forwarding=1` | env `BACKEND_URL=http://10.99.0.3:8000`, `INTERNAL_TOKEN=labtoken`, `LAN_IFACE=eth0`, `SCAN_INTERVAL=5`, `RECONCILE_INTERVAL=5`, `RESIST_INTERVAL=5`, `PORTAL_REDIRECT_URL=http://task4ce.local/kid`; `entrypoint: ["sh","-c","ip route replace default via 10.99.0.2 && ip -6 route replace default via fd00:99::2; exec python3 -m blocker"]` |
| `kid1` | `lab/host` (alpine + curl + bind-tools) | `lab` 10.99.0.11 / fd00:99::11 | `02:99:00:00:00:11` | NET_ADMIN | entrypoint sets v4+v6 default route via router, `sleep infinity`; `dns: [10.99.1.1]` |
| `kid2` | same | `lab` 10.99.0.12 / fd00:99::12 | `02:99:00:00:00:12` | same | |
| `parent` | same | `lab` 10.99.0.13 / fd00:99::13 | `02:99:00:00:00:13` | same | |

Networks: `lab` bridge, `internal: true`, `enable_ipv6: true`, subnets `10.99.0.0/24`, `fd00:99::/64`; `wan` bridge, `internal: true`, `enable_ipv6: true`, subnets `10.99.1.0/24`, `fd00:99:1::/64`. Compose project name `task4ce-lab` (top-level `name:`).

- [ ] **Step 1: Write the failing test** `blocker/tests/test_lab_compose.py`: parse `lab/docker-compose.lab.yml` with PyYAML (`importorskip` like `test_compose.py`), assert the table above: each service's `mac_address`, `ipv4_address`, `cap_add`, `sysctls`, `internal: true` on both networks, blocker has no `network_mode`, backend has no `ports`.

- [ ] **Step 2: Run to verify fail**

Run: `cd blocker && python -m pytest tests/test_lab_compose.py -v`
Expected: FAIL FileNotFoundError

- [ ] **Step 3: Write the compose file, Dockerfiles, entrypoints, `index.html`, and `lab/README.md`** (topology table above, how to run, caveat that it needs Linux Docker with bridge IPv6 enabled in daemon.json for the v6 tests).

- [ ] **Step 4: Verify YAML test passes, then bring the lab up once**

Run: `cd blocker && python -m pytest tests/test_lab_compose.py -v`
Expected: pass
Run: `docker compose -f lab/docker-compose.lab.yml up -d --build && docker compose -f lab/docker-compose.lab.yml exec kid1 curl -s -m 3 http://10.99.1.1/ && docker compose -f lab/docker-compose.lab.yml down -v`
Expected: prints the fake-internet page (contains "fake internet")

- [ ] **Step 5: Commit**

```bash
git add lab/ blocker/tests/test_lab_compose.py
git commit -m "feat(lab): docker network lab with router, fake internet, kids"
```

---

### Task 7: `scripts/lab.sh` driver

**Files:**
- Create: `scripts/lab.sh` (executable)
- Test: manual run in Step 4; exercised by Task 8's integration tests.

**Interfaces:**
- Produces, all run from repo root, `set -euo pipefail`, `COMPOSE="docker compose -f lab/docker-compose.lab.yml"`:
  - `lab.sh up` — `$COMPOSE up -d --build`, wait until `GET http://10.99.0.3:8000/health` (via `exec parent curl`) returns 200 and blocker `GET http://10.99.0.4:7777/health` returns 200, then **seed**: `POST /api/v1/setup` with `{"family_name":"Lab","timezone":"UTC","parent":{"username":"labparent","password":"labpassword1","full_name":"Lab Parent"}}` (ignore 4xx "already done"), then wait until `GET /api/v1/devices` (logged in) lists MACs `02:99:00:00:00:11` and `02:99:00:00:00:12` (discovery, up to 60 s).
  - `lab.sh down` — `$COMPOSE down -v`.
  - `lab.sh token` — prints an access token: `POST /api/v1/auth/login {"username":"labparent","password":"labpassword1"}` → `.access_token`.
  - `lab.sh device-id <kidN>` — maps `kid1→02:99:00:00:00:11`, `kid2→…12`, `parent→…13`; prints the backend device id from `GET /api/v1/devices`.
  - `lab.sh block <kidN>` — `POST /api/v1/devices/{id}/override {"action":"lock"}`; `unblock` — `{"action":"unlock"}`. (Real policy path: backend tick → `push_blocked` → blocker `/state`.)
  - `lab.sh check <kidN>` — `exec <kidN> curl -s -m 3 -o /dev/null http://10.99.1.1/`; exit 0 = online, 1 = offline.
  - `lab.sh check6 <kidN>` — `exec <kidN> curl -s -m 3 -o /dev/null http://[fd00:99:1::1]/` (fake-internet over IPv6, off-LAN so the block applies). Exit 0 = online, 1 = offline.
  - `lab.sh portal <kidN>` — asserts `nslookup example.com` inside kid resolves to `10.99.0.4` **and** `curl -s -m 3 -o /dev/null -w '%{http_code} %{redirect_url}' http://example.com/` prints `302 http://task4ce.local/kid`; exit 0 on both, 1 otherwise.
  - `lab.sh resist <kidN>` — `exec <kidN> ip neigh replace 10.99.0.2 lladdr 02:99:00:00:00:02 nud permanent dev eth0` and `ip -6 neigh replace fd00:99::2 lladdr 02:99:00:00:00:02 nud permanent dev eth0`.
  - `lab.sh reset <kidN>` — `ip neigh flush dev eth0` (v4 and v6).
  - `lab.sh resisting <kidN>` — prints `true`/`false` from `GET /api/v1/devices` `.resisting` for that device.
  - `lab.sh test-block <kidN>` — `POST /api/v1/devices/{id}/test-block`, prints the JSON.
  All HTTP from inside the `parent` container (`exec parent curl …`), since `lab` is internal. `jq` installed in `lab/host` image.

- [ ] **Step 1: Write `scripts/lab.sh`** per the Interfaces block. One `case "$1"` dispatch, helper functions `_curl_parent`, `_mac_of`, `_id_of`, `_token`.

- [ ] **Step 2: Shell-check**

Run: `bash -n scripts/lab.sh && (command -v shellcheck >/dev/null && shellcheck scripts/lab.sh || true)`
Expected: no syntax errors

- [ ] **Step 3: Manual run**

Run:
```bash
scripts/lab.sh up
scripts/lab.sh check kid1; echo "online=$?"
scripts/lab.sh block kid1; sleep 15
scripts/lab.sh check kid1; echo "online=$?"
scripts/lab.sh portal kid1; echo "portal=$?"
scripts/lab.sh unblock kid1; sleep 15
scripts/lab.sh check kid1; echo "online=$?"
scripts/lab.sh down
```
Expected: `online=0`, then `online=1`, `portal=0`, then `online=0`

- [ ] **Step 4: Commit**

```bash
git add scripts/lab.sh
git commit -m "feat(lab): lab.sh driver for block/check/resist"
```

---

### Task 8: Lab integration tests + CI job

**Files:**
- Create: `blocker/tests/lab/__init__.py`, `blocker/tests/lab/test_lab.py`
- Modify: `.github/workflows/ci-cd.yml` (add job `lab`)
- Modify: `pyproject.toml` only if the `integration` marker is not already registered for `blocker` (it is at line ~114; verify)

**Interfaces:**
- Consumes: `scripts/lab.sh` subcommands (Task 7).

- [ ] **Step 1: Write the tests**

```python
# blocker/tests/lab/test_lab.py
import os, shutil, subprocess, time
import pytest

pytestmark = pytest.mark.integration
LAB = ["bash", os.path.join(os.path.dirname(__file__), "../../../scripts/lab.sh")]

def lab(*args, check=False) -> subprocess.CompletedProcess:
    return subprocess.run([*LAB, *args], capture_output=True, text=True, check=check)

def wait_for(pred, timeout=60, every=2):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred(): return True
        time.sleep(every)
    return False

@pytest.fixture(scope="module", autouse=True)
def lab_up():
    if not shutil.which("docker"):
        pytest.skip("docker not available")
    lab("up", check=True)
    yield
    lab("down")

@pytest.fixture(autouse=True)
def clean_kid1():
    yield
    lab("reset", "kid1"); lab("unblock", "kid1")
    assert wait_for(lambda: lab("check", "kid1").returncode == 0)

def test_block_cuts_internet_and_unblock_restores():
    assert lab("check", "kid1").returncode == 0
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    lab("unblock", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 0)

def test_sibling_stays_online_while_kid1_blocked():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    assert lab("check", "kid2").returncode == 0

def test_captive_portal_dns_and_redirect():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("portal", "kid1").returncode == 0)

@pytest.mark.xfail(strict=False, reason="bridge IPv6 may be disabled on this Docker host")
def test_ipv6_blocked_too():
    assert lab("check6", "kid1").returncode == 0
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check6", "kid1").returncode == 1)

def test_static_arp_bypasses_but_is_flagged():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    lab("resist", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 0, timeout=30)   # the ceiling: bypass works
    assert wait_for(lambda: lab("resisting", "kid1").stdout.strip() == "true", timeout=60)
    out = lab("test-block", "kid1", check=True).stdout
    assert '"reason": "device"' in out or '"reason":"device"' in out
    lab("reset", "kid1", check=True)
    assert wait_for(lambda: lab("resisting", "kid1").stdout.strip() == "false", timeout=60)

def test_box_restart_fails_open():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    subprocess.run(["docker", "compose", "-f", "lab/docker-compose.lab.yml", "stop", "blocker"], check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 0, timeout=90)
    subprocess.run(["docker", "compose", "-f", "lab/docker-compose.lab.yml", "start", "blocker"], check=True)
```

- [ ] **Step 2: Run locally**

Run: `cd blocker && python -m pytest tests/lab -m integration -v -s`
Expected: 6 passed (or 5 passed + 1 xfail on hosts without bridge IPv6)

- [ ] **Step 3: Add CI job** to `.github/workflows/ci-cd.yml` after `test`:

```yaml
  lab:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v4
      with: { python-version: '3.11' }
    - run: pip install pytest pyyaml
    - name: Enable IPv6 on Docker bridges
      run: |
        echo '{"ipv6": true, "fixed-cidr-v6": "fd00:d0c::/64"}' | sudo tee /etc/docker/daemon.json
        sudo systemctl restart docker
    - name: Lab integration tests
      run: cd blocker && python -m pytest tests/lab -m integration -v
    - name: Lab logs on failure
      if: failure()
      run: docker compose -f lab/docker-compose.lab.yml logs --no-color
```

- [ ] **Step 4: Verify unit CI still skips integration**

Run: `cd blocker && python -m pytest -q`
Expected: lab tests reported as deselected/skipped (marker default), everything else passes

- [ ] **Step 5: Commit, push, confirm the `lab` job is green**

```bash
git add blocker/tests/lab .github/workflows/ci-cd.yml
git commit -m "test(lab): end-to-end enforcement and resistance tests in CI"
```

---

### Task 9: Docs: router compatibility list, blocker docs, debt ledger

**Files:**
- Create: `docs/routers.md`
- Modify: `docs/blocker.md` (add "What it can't do" section with the Task 5 promise copy, "Test block" meanings, resisting alert meaning, link to `docs/routers.md` and the ADR)
- Modify: `docs/superpowers/specs/2026-10-20-task4ce-v2-design.md:55-68` (bypass matrix rows: "Laptop admin pins static ARP for router" → "Not prevented; **detected**: device flagged and parents notified (Plan 5)"; add row "Router anti-spoofing" → "Test block says 'router'; see docs/routers.md")

- [ ] **Step 1: Write `docs/routers.md`**: table with columns Router / Works? / Notes; seed rows: "Most ISP routers — Works", "Eero (mesh) — Often resists; try disabling 'Client steering' / use a wired box", "Google Wifi / Nest Wifi — Often resists", "UniFi with 'Client device isolation' — Resists until isolation is off", "Asus AiMesh — Usually works". Intro sentence: how "Test block" feeds this list and how to report a router (GitHub issue template link).

- [ ] **Step 2: Update `docs/blocker.md` and the spec rows** as listed.

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: router compatibility list, honest ceiling, resisting alert"
```

---

### Task 10: Branch finish

- [ ] **Step 1:** `cd blocker && python -m pytest -q && ruff check . && ruff format --check .`; `cd backend && python -m pytest -q && ruff check .`; `cd frontend && npm test -- --silent && npm run lint`; `cd blocker && python -m pytest tests/lab -m integration -q`. All green.
- [ ] **Step 2:** Use superpowers:requesting-code-review on the whole branch, then superpowers:finishing-a-development-branch (PR to `main`, semantic title `feat: blocker hardening, resistance detection and network lab`).
