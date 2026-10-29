# v3 Plan F — Apprise notifications + bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parents get t@sk4ce pings in the chat apps they already use (Apprise "places" with per-place events, quiet hours, app-address links), and the bell matches §3.7 (notes, alerts, inline actions, footer).

**Architecture:** `services/inbox.py` stays the single choke point: a new `inbox.notify_parents()` writes bell rows **and** queues an Apprise ping through `services/notify.py`. Pings are resolved to places inside the request's transaction and handed to a small thread pool from a SQLAlchemy `after_commit` hook, so a rollback sends nothing and a slow chat app never blocks the request. Time-based events (held quiet-hour batch, overdue, box offline, daily summary, locked/unlocked) run in `services/notify_jobs.py`, called once per lock-loop tick. The frontend adds a Settings → Notifications pane and reworks the existing bell (`src/v2/components/Bell.tsx`), split into smaller files.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (SQLite, `batch_alter_table`), pytest, `apprise`, `cryptography` (Fernet); Next.js pages router, React Query, Mantine, jest, Playwright (`frontend/e2e`).

**Spec:** `docs/superpowers/specs/2026-10-24-v3-redesign-design.md` §6.1, §3.7, §3.6 (Notifications), §3.10 (empty bell), §7 last line, §12. Mockups: `02-parent-screens.html` (Bell popover lines 250–291, Settings → Notifications lines 650–661), `04-parent-phone.html` (More → Notifications row), `05-states.html` ("Bell · empty"), `07-setup.html` (finish: "Set up notifications").

**Repo:** `/home/user/code/tskfrce-v3a`, branch `feat/v3-parent-restyle`. Backend venv: `/home/user/code/tskfrce-redesign/.venv/bin` (below: `$V`). Backend commands run from `backend/`, frontend from `frontend/`.

## Global Constraints

- Files under 500 lines. `Bell.tsx` is 388 lines today: Task 9 splits it before adding anything.
- Semantic commits, each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push. Stage only the files you touched (`git add <paths>`, never `-A`/`.`); on `index.lock`, wait a few seconds and retry.
- Before each commit: backend `$V/ruff format --check . && $V/ruff check . && $V/python -m pytest -q`; frontend `npx tsc --noEmit && npm run lint && npx jest`. Never run prettier (if `ruff format --check` fails, run `$V/ruff format <your files>` only).
- A live demo backend runs from this checkout with `--reload`. **Install the new packages (Task 1 Step 1) before any app file imports them.** Don't restart the demo servers. After Task 2 the demo DB needs `alembic upgrade head`; ask the controller before running it against the demo DB.
- Other plans (C, D, E) add migrations too. **Re-run `$V/alembic heads` right before writing Task 2's migration** and set `down_revision` to whatever single head it prints (today: `k4d5e6f7a8b9`). If it prints two heads, stop and report.
- Parent UI: `--p-*` tokens, `Icon` (Material Symbols names), `p-btn`, `Chip`; no emojis; no neon text on light backgrounds; popovers are solid cards with 2px ink border + accent offset shadow (§2.2).
- Copy is plain sentence case. API error `detail` strings are full sentences.
- §6.2 kid push (ntfy) is Plan C. Do not build it here. Kid bell behaviour stays as is.
- Event keys and labels (labels are mockup copy, verbatim), in this order:

  | key | label | bell kinds that trigger it | security |
  |---|---|---|---|
  | `chore_ok` | Chore needs OK | `chore_submitted` | no |
  | `kid_note` | Kid note | `chore_note` | no |
  | `reward_request` | Reward request | `redemption_request` | no |
  | `new_device` | New device | `new_device` | no |
  | `resisting` | Device resisting | `device_resisting`, `device_bypass` | **yes** |
  | `badge` | Badge / level up | `badge_earned`, `level_up` | no |
  | `summary` | Daily summary | (Apprise only) | no |
  | `box_offline` | Box offline | `box_offline` | **yes** |
  | `lock_change` | Locked / unlocked | (Apprise only) | no |
  | `overdue` | Overdue | (Apprise only) | no |

- New place default events: `chore_ok, kid_note, reward_request, new_device, resisting, box_offline` (the mockup's first place).
- Quiet hours (family local time, `fam.timezone`): security events always send when `quiet_security` is on (default on). **Held** during quiet hours, then sent as one batch per place: `chore_ok, kid_note, reward_request, new_device`. **Dropped** during quiet hours: `badge, summary, lock_change, overdue` (stale by morning).
- Daily summary time: `SUMMARY_AT = "19:00"` family local. Box offline after `OFFLINE_AFTER = 10 min` without a blocker heartbeat.
- Ping format: `title` = the bell title; `body` = bell body, then a blank line, then the link (`<app address><path>`) when an address is known. App address = `notify settings app_address`, else `settings.BOX_URL`, else no link.

## Interface for Plan D (and E)

Plan D's bypass alert calls exactly this (no other wiring needed; it is a security event, so it ignores quiet hours and lands in the bell's **Alerts** tab with View / Ask <kid>):

```python
from app.services import inbox
inbox.notify_parents(db, "device_bypass", f"{dev.name} got around the lock", "6 min while locked · re-locked", device_id=dev.id)
db.commit()  # the ping leaves only after this commit
```

Apprise-only (no bell row): `notify.ping(db, event: str, title: str, body: str | None = None, path: str | None = None) -> None` with an event key from the table above.

## Owner decisions (2026-10-26)

Accepted as planned: Decision 1 (held vs dropped in quiet hours), Decision 3 (19:00 summary, fixed), Decision 2 (box offline uses the blocker heartbeat, no recovery ping), Decision 4/5 and the Apprise-only rule (locked/unlocked and overdue pings have no bell rows), `apprise` and `cryptography` dependencies, and the controller runs the demo DB migration (Task 2 note; agents never migrate the demo DB themselves).

**New requirement:** the Today page's **Needs you** list also shows kid notes, using the same server-computed rule as the bell: a note is "needs you" while its run has `note_label is not None and status == "todo"`. One helper, `inbox.is_pending_note(run)`, is the single definition, used by Task 7 (`pending` on bell items) and by the Today payload (`_needs_you` in `api/family.py`). Backend in Task 7, frontend in Task 9.

## Decisions taken (owner answers applied, see above)

1. **Held vs dropped** in quiet hours: actionable events held and batched, informational ones dropped (table above).
2. **Box offline** = the blocker heartbeat (`family.blocker_last_seen`) is older than 10 min; one ping per outage, nothing on recovery. Never fires before the first heartbeat.
3. **Daily summary** at 19:00 family time; one ping per day; dropped if 19:00 is inside quiet hours.
4. **Locked/unlocked** = change in the set of blocked devices **that have an owner**, one ping per tick listing names; first tick after start is a baseline (no ping).
5. **Overdue** = a today run still `todo` whose `svc.due_at` passed since the previous tick; one ping per run. Missed while the server was down = not sent.
6. Bell tabs follow the mockup counts (All 5 · Needs you 3 · Alerts 1): **Needs you** = pending chore OKs, pending reward requests, kid notes whose run still carries its note flag; **Alerts** = `device_resisting`, `device_bypass`, `box_offline` only. `new_device` shows under All only.
7. "Pending" is computed by the server (`pending` on each notification) instead of the bell cross-reading `/today`.
8. Parents now get bell rows for automatic badges and level-ups ("Mia reached On Fire · Silver", "Ava levelled up to 9"), as in the mockup. Parent-awarded custom badges don't ping parents.
9. Apprise URLs: Fernet-encrypted with a key derived from `SECRET_KEY` (changing `SECRET_KEY` makes stored places unreadable → they are skipped and the card says "Re-enter this address"). Masked form stored beside it.
10. "See all" opens a new `/notifications` page (same list, full width).

## Review Focus

1. A request that rolls back after `notify_parents` (e.g. IntegrityError path in `internal.py`) must send **no** ping. → Task 3 `test_rollback_sends_nothing`.
2. Quiet hours crossing midnight (21:30→07:00) in a non-UTC family zone. → Task 3 `test_quiet_hours_cross_midnight_family_tz`.
3. A place whose stored URL can't be decrypted (secret rotated) must not break other places or the request. → Task 3 `test_unreadable_place_is_skipped`.
4. Apprise raising (bad network, plugin bug) inside the background send must be logged, never re-raised. → Task 3 `test_deliver_swallows_errors`.
5. Bell action on a stale item (chore already approved by the other parent) shows no buttons. → Task 9 test `no actions when not pending`.
6. A kid note counts as "needs you" on the bell and on Today by the same rule, and leaves both once the flag clears. → Task 7 `test_today_needs_you_includes_pending_notes`, Task 9 `needsYouList.test.tsx`.

---

### Task 1: Dependencies and URL sealing

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/core/crypto.py`
- Test: `backend/tests/test_crypto.py`

**Interfaces:**
- Produces: `seal(text: str) -> str`, `unseal(token: str) -> str` (raises `ValueError("unreadable")` on a bad/foreign token).

- [x] **Step 1: Install and pin packages.** Run `$V/pip index versions apprise` and `$V/pip index versions cryptography`; pick the newest version of each released at least two weeks ago; `$V/pip install apprise==<a> cryptography==<c>`. Add under a new `# Notifications` heading in `requirements.txt`: `apprise==<a>` and `cryptography==<c>`.

- [x] **Step 2: Write the failing test** `tests/test_crypto.py`:

```python
import pytest
from app.core.crypto import seal, unseal

def test_roundtrip_and_not_plaintext():
    t = seal("discord://abc/def")
    assert t != "discord://abc/def" and unseal(t) == "discord://abc/def"

def test_garbage_raises_value_error():
    with pytest.raises(ValueError):
        unseal("not-a-token")
```

- [x] **Step 3: Run** `$V/python -m pytest tests/test_crypto.py -q` → FAIL (ImportError).

- [x] **Step 4: Implement `app/core/crypto.py`.** Fernet key = `base64.urlsafe_b64encode(hashlib.sha256(("apprise:" + settings.SECRET_KEY).encode()).digest())`, built lazily (functools.cache). `unseal` catches `cryptography.fernet.InvalidToken` and re-raises `ValueError("unreadable")`.

- [x] **Step 5: Run** the test → PASS. Run backend CI commands.

- [x] **Step 6: Commit** `feat(notify): apprise + url sealing` (stage `requirements.txt`, `app/core/crypto.py`, the test).

---

### Task 2: Models and migration

**Files:**
- Create: `backend/app/models/notify.py`
- Modify: `backend/app/models/__init__.py` (import + `__all__`), `backend/app/models/family.py`, `backend/app/models/inbox.py`
- Create: `backend/alembic/versions/l5f6a7b8c9d0_apprise_notifications.py`
- Test: `backend/tests/test_notify_models.py` (+ existing `tests/test_migrations.py` must pass)

**Interfaces:**
- Produces:
  - `NotifyPlace` table `notify_places`: `id` int pk; `name` String(60) not null; `url_enc` Text not null; `url_mask` String(80) not null; `enabled` Boolean not null default true (server_default `"1"`); `events` String(200) not null (comma-separated keys); `created_at` DateTime default `datetime.utcnow`.
  - `NotifyHeld` table `notify_held`: `id` pk; `place_id` FK `notify_places.id` ondelete CASCADE, not null, index; `title` String(120) not null; `body` String(300) null; `created_at` DateTime not null default utcnow.
  - `FamilySettings` new columns: `quiet_start` String(5) null; `quiet_end` String(5) null; `quiet_security` Boolean not null default true (server_default `"1"`); `app_address` String(200) null; `summary_date` Date null; `notify_scan_at` DateTime null (naive UTC); `blocker_alerted` Boolean not null default false (server_default `"0"`).
  - `inbox.KINDS` gains `"device_bypass"` and `"box_offline"` (append, keep order).

- [x] **Step 1: Write the failing test** `tests/test_notify_models.py`:

```python
from app.models.family import get_family
from app.models.inbox import KINDS
from app.models.notify import NotifyHeld, NotifyPlace

def test_place_and_held_cascade(db):
    p = NotifyPlace(name="Signal", url_enc="x", url_mask="signal://••••", events="chore_ok")
    db.add(p); db.flush()
    db.add(NotifyHeld(place_id=p.id, title="t")); db.commit()
    assert p.enabled is True
    db.delete(p); db.commit()
    assert db.query(NotifyHeld).count() == 0

def test_family_defaults_and_kinds(db):
    fam = get_family(db); db.commit()
    assert fam.quiet_security is True and fam.blocker_alerted is False and fam.quiet_start is None
    assert {"device_bypass", "box_offline"} <= set(KINDS)
```

- [x] **Step 2: Run** → FAIL (ImportError).
- [x] **Step 3: Implement** the models and columns above. Register `NotifyPlace`, `NotifyHeld` in `app/models/__init__.py`.
- [x] **Step 4: Run** `$V/alembic heads` (see Global Constraints), then write the migration: `revision = "l5f6a7b8c9d0"`, `down_revision = <the head>`. Upgrade: `op.create_table` both tables (index `ix_notify_held_place_id`); `batch_alter_table("family_settings")` add the 7 columns (booleans with the server_defaults above); `batch_alter_table("notifications")` drop + recreate `ck_notification_kind` with the full new `KINDS` list **written out literally in the migration** (copy the pattern at `alembic/versions/h1a2b3c4d5e6_chore_model_v3.py:149-151`). If another plan's migration landed first and changed the kind list, include its kinds too. Downgrade: `DELETE FROM notifications WHERE kind IN ('device_bypass','box_offline')`, restore the previous CHECK list, drop the columns and tables.
- [x] **Step 5: Run** `$V/python -m pytest tests/test_notify_models.py tests/test_migrations.py -q` → PASS.
- [x] **Step 6: Commit** `feat(notify): places, held pings, quiet-hour columns`.

---

### Task 3: Notify core (`services/notify.py`)

**Files:**
- Create: `backend/app/services/notify.py`
- Modify: `backend/tests/conftest.py` (add the `pings` fixture)
- Test: `backend/tests/test_notify_core.py`

**Interfaces:**
- Consumes: Task 1 `seal/unseal`; Task 2 models.
- Produces:
  - `EVENTS: dict[str, str]` key → label (table order); `SECURITY = {"resisting", "box_offline"}`; `HELD = {"chore_ok", "kid_note", "reward_request", "new_device"}`; `DEFAULT_EVENTS = ("chore_ok", "kid_note", "reward_request", "new_device", "resisting", "box_offline")`; `KIND_EVENT: dict[str, str]` bell kind → event (table).
  - `in_quiet(fam, now_utc: datetime) -> bool`
  - `link(fam, path: str | None) -> str | None`
  - `ping(db, event: str, title: str, body: str | None = None, path: str | None = None) -> None` — resolves enabled places whose `events` contains `event`; per place: security event → send; quiet and `event in HELD` → add `NotifyHeld(place_id, title[:120], body[:300])`; quiet otherwise → skip; else → send. "Send" = append `(urls, title, text)` to `db.info["pings"]`. Places whose URL fails `unseal` are skipped with a log warning.
  - `deliver(urls: list[str], title: str, body: str) -> tuple[bool, str | None]` — builds `apprise.Apprise()`, `.add(url)` each, `.notify(title=title, body=body, body_format=apprise.NotifyFormat.TEXT)` inside `apprise.LogCapture(level=apprise.logging.WARNING)`; returns `(True, None)` or `(False, last non-empty captured line[:300] or "It didn't go through.")`. Catches every exception → `(False, str(exc)[:300])`. Never raises.
  - `_submit(fn, *args) -> None` — `_pool.submit(fn, *args)` on a module-level `ThreadPoolExecutor(max_workers=2, thread_name_prefix="apprise")`.
  - SQLAlchemy listeners registered at import on `sqlalchemy.orm.Session`: `after_commit` → pop `session.info["pings"]` and `_submit(_send, urls, title, text)` for each (`_send` calls `deliver` and logs failures with the place-free message); `after_rollback` → `session.info.pop("pings", None)`.
  - `pings` pytest fixture (conftest): monkeypatches `notify._submit` to call inline and `notify.deliver` to append `(urls, title, body)` to a list it returns, and returns `(True, None)`.

`in_quiet` rule: either bound `None` or `start == end` → False; local `t = HH:MM` in `ZoneInfo(fam.timezone)`; `start < end` → `start <= t < end`; else `t >= start or t < end`. `link`: base = `fam.app_address or settings.BOX_URL`; `None` if no base or no path; else `base.rstrip("/") + path`. Ping text = `body`, then `"\n\n" + link` when link; if no body, just the link (or `""`).

- [x] **Step 1: Write the failing tests** `tests/test_notify_core.py` (helper `_place(db, events=DEFAULT_EVENTS, url="json://localhost/x")` creates a place with `seal(url)`):

```python
def test_ping_sends_after_commit_only(db, pings):
    _place(db); notify.ping(db, "chore_ok", "Mia finished Homework", "Take a look.", "/?chore=7")
    assert pings == []
    db.commit()
    assert pings == [(["json://localhost/x"], "Mia finished Homework", "Take a look.")]  # no address set → no link

def test_link_uses_app_address(db, pings):
    fam = get_family(db); fam.app_address = "http://chores.local"; _place(db)
    notify.ping(db, "chore_ok", "T", "B", "/?chore=7"); db.commit()
    assert pings[0][2] == "B\n\nhttp://chores.local/?chore=7"

def test_rollback_sends_nothing(db, pings):
    _place(db); notify.ping(db, "chore_ok", "T"); db.rollback(); db.commit()
    assert pings == []

def test_event_not_selected_or_disabled(db, pings):
    _place(db, events=("badge",)); p = _place(db); p.enabled = False
    notify.ping(db, "chore_ok", "T"); db.commit()
    assert pings == []

def test_quiet_hours_cross_midnight_family_tz(db):
    fam = get_family(db); fam.timezone = "America/New_York"; fam.quiet_start, fam.quiet_end = "21:30", "07:00"
    assert notify.in_quiet(fam, datetime(2026, 1, 10, 3, 0, tzinfo=UTC))      # 22:00 local
    assert notify.in_quiet(fam, datetime(2026, 1, 10, 11, 59, tzinfo=UTC))    # 06:59 local
    assert not notify.in_quiet(fam, datetime(2026, 1, 10, 12, 0, tzinfo=UTC)) # 07:00 local
    fam.quiet_end = None
    assert not notify.in_quiet(fam, datetime(2026, 1, 10, 3, 0, tzinfo=UTC))

def test_quiet_holds_drops_and_lets_security_through(db, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda fam, now: True)
    p = _place(db, events=tuple(notify.EVENTS))
    for ev in ("chore_ok", "badge", "resisting"):
        notify.ping(db, ev, ev)
    db.commit()
    assert [t for _, t, _ in pings] == ["resisting"]
    assert [h.title for h in db.query(NotifyHeld).filter_by(place_id=p.id)] == ["chore_ok"]

def test_quiet_security_off_drops_security(db, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda fam, now: True)
    get_family(db).quiet_security = False; _place(db)
    notify.ping(db, "resisting", "x"); db.commit()
    assert pings == []

def test_unreadable_place_is_skipped(db, pings):
    bad = _place(db); bad.url_enc = "garbage"; _place(db, url="json://ok/y")
    notify.ping(db, "chore_ok", "T"); db.commit()
    assert [u for u, _, _ in pings] == [["json://ok/y"]]

def test_deliver_swallows_errors(monkeypatch):
    import apprise
    monkeypatch.setattr(apprise.Apprise, "notify", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    assert notify.deliver(["json://localhost/x"], "t", "b") == (False, "boom")
```

(`deliver` is the real function in the last test: don't request the `pings` fixture there.)

- [x] **Step 2: Run** `$V/python -m pytest tests/test_notify_core.py -q` → FAIL.
- [x] **Step 3: Implement** `services/notify.py` and the `pings` fixture as specified. Use `app.core.logging.get_logger`. Import `notify` from `app/main.py` is **not** needed (listeners register when `inbox` imports it in Task 4); in this task the tests import it directly.
- [x] **Step 4: Run** → PASS; run full backend CI.
- [x] **Step 5: Commit** `feat(notify): apprise dispatch after commit with quiet hours`.

---

### Task 4: Wire the choke point (`inbox.notify_parents`)

**Files:**
- Modify: `backend/app/services/inbox.py`, `backend/app/api/kid.py:245-252,289-296`, `backend/app/api/internal.py:103-110,137-153`, `backend/app/services/economy.py:84-87,160-167`, `backend/app/services/badges.py:168`
- Test: `backend/tests/test_notify_wiring.py` (existing `tests/test_inbox.py` must stay green)

**Interfaces:**
- Consumes: Task 3 `notify.ping`, `notify.KIND_EVENT`.
- Produces:
  - `path_for(kind: str, *, run_id=None, redemption_id=None, device_id=None) -> str` — device → `/devices?item={id}`; run → `/?chore={id}`; `redemption_request` → `/?tab=needs`; `box_offline` → `/devices`; else `/`.
  - `notify_parents(db, kind, title, body=None, *, run_id=None, redemption_id=None, device_id=None, thread_id=None) -> None` — `notify(db, parents(db), …)` then, if `kind in KIND_EVENT`, `notify.ping(db, KIND_EVENT[kind], title[:120], body, path_for(...))`.
  - `notify()` itself is unchanged (kid-addressed rows never ping).

- [x] **Step 1: Write the failing tests** `tests/test_notify_wiring.py` (reuse helpers from `tests/test_inbox.py`: `_submit`, plus `_place` from `tests/test_notify_core.py`):

```python
def test_submit_pings_with_chore_link(client, db, parent, kid, pings):
    get_family(db).app_address = "http://box"; _place(db); db.commit()
    r = _submit(db, parent, kid)
    assert len(pings) == 1 and pings[0][2].endswith("http://box/?chore=%d" % r.id)

def test_kid_rows_do_not_ping(db, kid, pings):
    _place(db, events=tuple(notify.EVENTS))
    inbox.notify(db, [kid.id], "level_up", "You reached level 3!"); db.commit()
    assert pings == []

def test_level_up_also_tells_parents(db, parent, kid, pings):
    _place(db, events=("badge",))
    economy.level_check(db, kid.id, before=0); db.commit()  # any XP ≥ level 1 crosses
    rows = db.query(Notification).filter_by(user_id=parent.id, kind="level_up").all()
    assert rows and rows[0].title == f"{kid.full_name} levelled up to {economy.level_of(db, kid.id)}"
    assert len(pings) == 1

def test_device_bypass_is_security(db, parent, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda f, n: True); _place(db)
    inbox.notify_parents(db, "device_bypass", "Pad got around the lock", device_id=None); db.commit()
    assert len(pings) == 1
```

(If `level_check(db, kid.id, before=0)` doesn't cross a level for a fresh kid, give the kid points first with the same pattern as `tests/test_progression.py`.)

- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** `path_for` and `notify_parents` in `inbox.py` (inbox imports `app.services.notify`, which registers the listeners). Replace every `inbox.notify(db, inbox.parents(db), …)` / `inbox.notify(db, parents, …)` call listed under Files with `inbox.notify_parents(db, …)` (same kind, title, body, refs; in `internal.py` resisting loop drop the local `parents` variable). Add parent rows:
  - `economy.level_check`: after the kid row, `inbox.notify_parents(db, "level_up", f"{name} levelled up to {now}")` where `name = db.get(User, kid_id).full_name`.
  - `badges.check_badges` (line 168 only, not the custom-award at 233): `inbox.notify_parents(db, "badge_earned", f"{kid.full_name} reached {b.name} · {TIERS[tier - 1]}")`.
- [x] **Step 4: Run** `$V/python -m pytest tests/test_notify_wiring.py tests/test_inbox.py tests/test_badges.py tests/test_progression.py tests/test_query_counts.py -q` → PASS. If a test asserted exact notification counts for parents and now sees the extra badge/level rows, update that assertion (the new rows are intended).
- [x] **Step 5: Commit** `feat(notify): notify_parents pings apprise from the inbox choke point`.

---

### Task 5: Places + settings API

**Files:**
- Create: `backend/app/api/notify.py`
- Modify: `backend/app/main.py` (include router next to `family_router`)
- Test: `backend/tests/test_notify_api.py`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (all `require_parent`, prefix `/api/v1/notify`):
  - `GET /places` → `[{id, name, url_mask, enabled, events: [str], readable: bool}]` ordered by id. `readable` = `unseal` works.
  - `POST /places` body `{name: str 1–60, url: str 1–1000, events?: [str], enabled?: bool}` → 201 place. Unknown event key → 422 "Pick events from the list."; `apprise.Apprise().add(url)` False → 422 "Apprise can't read that address. Check it against the Apprise wiki."
  - `PATCH /places/{id}` body any of `{name, url, events, enabled}` (same validation) → place. 404 "That place doesn't exist."
  - `DELETE /places/{id}` → 204.
  - `POST /places/{id}/test` → `{ok: bool, error: str | None}`; calls `notify.deliver([url], "t@sk4ce test", "If you can read this, pings will reach this place.")` **synchronously**; unreadable URL → `{ok: false, error: "Re-enter this address."}`.
  - `GET /settings` → `{quiet_start, quiet_end, quiet_security, app_address, app_address_default: settings.BOX_URL, events: [{key, label, security: bool}]}`.
  - `PATCH /settings` body any of `{quiet_start: "HH:MM" | null, quiet_end: "HH:MM" | null, quiet_security: bool, app_address: str ≤200 | ""}` → same shape as GET. `app_address` must start with `http://` or `https://` (422 "Start the address with http:// or https://."), stored with trailing `/` stripped; `""` clears to null. Reuse `_hhmm` from `app/schemas/lock.py` for the times.
  - `mask(url: str) -> str` (module function): `scheme://` + first 4 chars after `://` + `"••••"`; no `://` → `"••••"`. Truncate to 80.

- [x] **Step 1: Write the failing tests** `tests/test_notify_api.py` covering: create → list shows `url_mask` and never the raw URL (`"abcdef" not in res.text`); bad URL 422 with the exact detail; unknown event 422; kid token → 403; PATCH events round-trip; delete 204 then 404 on PATCH; test endpoint with `monkeypatch.setattr(notify, "deliver", lambda u, t, b: (False, "401 Unauthorized"))` → `{"ok": False, "error": "401 Unauthorized"}`; settings PATCH `{"quiet_start": "21:30", "quiet_end": "07:00", "app_address": "http://chores.local/"}` → GET returns `"http://chores.local"`; `app_address: "chores.local"` → 422; `events` list length 10 with `security` true only for `resisting` and `box_offline`.
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** `api/notify.py` (pydantic bodies inline in the module) and include the router.
- [x] **Step 4: Run** → PASS; backend CI.
- [x] **Step 5: Commit** `feat(notify): places and quiet-hours API`.

---

### Task 6: Timed jobs (held batch, overdue, box offline, summary, lock changes)

**Files:**
- Create: `backend/app/services/notify_jobs.py`
- Modify: `backend/app/lock/loop.py` (`_run_once`)
- Test: `backend/tests/test_notify_jobs.py`

**Interfaces:**
- Consumes: `notify.ping`, `notify.in_quiet`, `notify.link`, `inbox.notify_parents`, `svc.today`, `svc.state`, `svc.due_at`, `svc.chore_of`, `svc.run_kid_ids` (`app/services/chores.py`).
- Produces:
  - `tick(db, now_utc: datetime, blocked: list[str] | None = None) -> None` — calls the five functions below in order, then `db.commit()`.
  - `flush_held(db, now_utc)` — if not `in_quiet`: for each place with held rows (oldest first), delete them and queue one send to that place only: title `f"While you were away: {n} updates"` (n == 1 → `"While you were away: 1 update"`), body = lines `f"• {title}"`, then link for `/?tab=needs`. Add a helper `notify.send_to(db, place, title, text)` in `notify.py` for this direct, place-specific queueing.
  - `overdue(db, now_utc)` — `prev = fam.notify_scan_at`; set `fam.notify_scan_at = now` (naive UTC); if `prev is None` return; for today's runs with `svc.state(r) == "todo"` and `prev < due <= now` (`due = svc.due_at(r, fam)`, naive UTC compare): `notify.ping(db, "overdue", f"{names} hasn't finished {title}", f"It was due at {local h:mm AM/PM}.", f"/?chore={r.id}")` where `names` = kid full names joined with " and ".
  - `box_offline(db, now_utc)` — `seen = fam.blocker_last_seen`; `seen is None` → return; stale (`now - seen > OFFLINE_AFTER`) and not `fam.blocker_alerted` → `inbox.notify_parents(db, "box_offline", "Home box offline", "The blocker hasn't checked in for 10 minutes, so devices can't be locked or unlocked.")`, set flag; fresh and flag → clear flag (no ping).
  - `daily_summary(db, now_utc)` — local now ≥ `SUMMARY_AT` and `fam.summary_date != local date` → set `summary_date`; `notify.ping(db, "summary", f"Today at {fam.name}", body, "/")` where body lines are `f"{kid}: {done} of {total} done"` per active kid with runs today (done = state `done`; total excludes `skipped`), then `f"{n} waiting for your OK"` when n (state `needs_you`) > 0.
  - `lock_changes(db, blocked: list[str] | None)` — module `_last: set[str] | None`. `None` blocked → return. First call → baseline. Else for MACs newly in / newly out of the set, take `Device` rows **with owners**; one `notify.ping(db, "lock_change", "Locked: " + ", ".join(names), None, "/devices")` and one for `"Unlocked: …"` when non-empty. Update `_last`.
- `loop._run_once`: keep `blocked = tick(db, now)`; `push_blocked(blocked)`; then in its own `try/except Exception` (log `"Notify jobs failed"`) call `notify_jobs.tick(db, now, blocked)`.

- [x] **Step 1: Write the failing tests** `tests/test_notify_jobs.py` (use `pings` + `_place(db, events=tuple(notify.EVENTS))`; build runs with `tests.factories.make_run(..., due_time="17:00")` on `svc.today(db)`; family timezone `UTC` for easy times):
  - `test_flush_held_batches_per_place`: two `NotifyHeld` rows on one place, `in_quiet` patched False → one ping titled `"While you were away: 2 updates"`, body starts with `"• "`, table empty afterwards; patched True → nothing sent, rows kept.
  - `test_overdue_fires_once_in_window`: first `overdue(now=16:59)` sets baseline (no ping); `overdue(now=17:01)` → one ping containing `"hasn't finished"`; `overdue(now=17:02)` → still one.
  - `test_box_offline_once_and_resets`: `blocker_last_seen = now-11min` → one bell row `box_offline` per parent + one ping; second call → no more; `blocker_last_seen = now` → flag cleared.
  - `test_box_offline_never_before_first_heartbeat`: `blocker_last_seen=None` → nothing.
  - `test_summary_once_a_day_after_19`: 18:59 → nothing; 19:00 → one ping with `"0 of 1 done"`; 20:00 same day → still one.
  - `test_lock_changes_baseline_then_diff`: reset `notify_jobs._last = None`; owned device `aa:…:01` named "Mia's iPad" plus an un-owned one; `lock_changes(db, [])` → nothing; `lock_changes(db, [both macs])` → exactly one ping `"Locked: Mia's iPad"`; `lock_changes(db, [])` → `"Unlocked: Mia's iPad"`.
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** `notify_jobs.py`, `notify.send_to`, and the loop hook.
- [x] **Step 4: Run** → PASS; backend CI (incl. `tests/lock`).
- [x] **Step 5: Commit** `feat(notify): quiet-hour batch, overdue, box offline, summary, lock pings`.

---

### Task 7: Richer `/notifications` items

**Files:**
- Modify: `backend/app/api/inbox.py`, `backend/app/services/inbox.py` (`is_pending_note`), `backend/app/api/family.py` (`_needs_you` adds note items)
- Test: `backend/tests/test_inbox.py` (add tests), `backend/tests/test_today_payload.py`, `backend/tests/test_query_counts.py` (must stay ≤ its limit)

**Interfaces:**
- Produces: each item gains `kid_id: int | None`, `kid_name: str | None`, `glyph: str | None`, `points: int | None` (replaces the `getattr` stub), `pending: bool`.
  - Run-linked: `glyph` = `chore.type.glyph`; `points` = `chore.points`; kid = `run.submitted_by_id` or first of `svc.run_kid_ids(r)`; `pending` = `run.status == "submitted"` for `chore_submitted`, `run.note_label is not None and run.status == "todo"` for `chore_note`.
  - Redemption-linked: kid = `redemption.kid_id`; `pending` = `status == "pending"`.
  - Device-linked: kid = first owner (lowest id); `pending` = False.
  - Everything else: `pending` False, others None.
- `services/inbox.is_pending_note(run) -> bool` = `run.note_label is not None and run.status == "todo"`; `chore_note` `pending` uses it. `_needs_you` appends one item per today run where `is_pending_note(run)`: `{type: "note", id: run.id, kid_id, kid_name, title: chore title, note: run.note_label}` (kid = first of `svc.run_kid_ids(run)`), ordered after the existing items, one per run (a run already listed as chore/redo for the same run still gets its own note row).
- Batch loading: one query per ref type for the page (`ChoreRun` with `selectinload(assignment → chore → type)` and `selectinload(ChoreRun.kids)`; `Redemption`; `Device` with `selectinload(owners)`), plus one `User` name query for the collected kid ids. Helper `_enrich(db, rows) -> list[dict]` in `api/inbox.py`.

- [x] **Step 1: Write the failing tests** in `tests/test_inbox.py`: `test_items_carry_kid_glyph_points_pending` — after `_submit`, the parent's item has `glyph == "task_alt"` (Other, the factory default type; adjust if the factory sets another type), `points == r.assignment.chore.points`, `kid_name == kid.full_name`, `pending is True`; approve the run → `pending is False`. `test_note_pending_until_flag_clears` — kid posts a note (pattern in `tests/test_kid_notes.py`) → `pending True`; parent approves or replies → `False`.
`test_today_needs_you_includes_pending_notes` (in `test_today_payload.py`: kid posts a note → `/today` `needs_you` has a `type == "note"` item with the run id, kid name and note, and the same run's bell item has `pending True`; parent replies/approves → the note item is gone and `pending False`; a run with no note adds none).
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** `_enrich` and the `_needs_you` note items; `list_notifications` returns `_enrich(db, rows[:PAGE])`; `read_one` returns `_enrich(db, [n])[0]`.
- [x] **Step 4: Run** `tests/test_inbox.py tests/test_query_counts.py` → PASS.
- [x] **Step 5: Commit** `feat(inbox): kid, glyph, points and pending on notifications`.

---

### Task 8: Settings → Notifications pane

**Files:**
- Create: `frontend/src/v2/hooks/useNotify.ts`, `frontend/src/v2/manage/NotificationsPane.tsx`, `frontend/src/v2/manage/PlaceCard.tsx`, `frontend/src/v2/manage/PlaceForm.tsx`
- Modify: `frontend/src/v2/manage/SettingsPage.tsx`, `frontend/src/v2/parent/MorePage.tsx`, `frontend/src/v2/setup/StepFinish.tsx`, `frontend/src/v2/manage/manage.css` (or `parent-manage.css`, whichever holds `ps-*` rules)
- Test: `frontend/tests/v2/notificationsPane.test.tsx`

**Interfaces:**
- Consumes: Task 5 API.
- Produces:
  - `useNotify.ts`: types `Place {id; name; url_mask; enabled; events: string[]; readable: boolean}`, `NotifySettings {quiet_start: string|null; quiet_end: string|null; quiet_security: boolean; app_address: string|null; app_address_default: string|null; events: {key: string; label: string; security: boolean}[]}`; hooks `usePlaces()` (key `['notify','places']`), `useNotifySettings()` (key `['notify','settings']`), `useAddPlace()`, `usePatchPlace()` (`{id, ...patch}`), `useDeletePlace()`, `useTestPlace()` (returns `{ok, error}`), `usePatchNotifySettings()`. Mutations invalidate `['notify']`.
  - Settings section `{ id: 'notifications', label: 'Notifications', description: 'Chat app pings, quiet hours', icon: 'notifications' }`, inserted after `hours` in `SETTINGS_SECTIONS` (keep whatever other plans changed in that list).
  - MorePage row `{ href: '/settings?section=notifications', label: 'Notifications', sub: 'Pings to your chat apps', icon: 'notifications' }` after Hours.
  - StepFinish: second button "Set up notifications" (`leftSection` icon `notifications`, default variant) → `router.push('/settings?section=notifications')`.

Pane layout (mockup 02 `#sp-notif`, copy verbatim): header `h2` "Notifications", sub "Send t@sk4ce pings to the chat apps your family already uses.", accent button "Add a place" (icon `add`) opening `PlaceForm`. One `PlaceCard` per place: `h3` with icon `forum`, name, Mantine `Switch` (aria-label `Send to <name>`) on the right; row with icon `key`, the mask in mono, and a `p-btn` "Test"; event chips as `<button aria-pressed>` (accent fill when on) for each `settings.events` label, toggling via PATCH; a `p-btn` icon button `delete` (aria-label `Remove <name>`) using `ConfirmDelete` ("Remove this place?" / "t@sk4ce will stop sending pings there."). Unreadable place: amber banner "Re-enter this address" with "Change address" opening `PlaceForm` in edit mode (URL only). Below, a two-column grid: **Quiet hours** card (icon `bedtime`; `Switch` "Quiet hours" — turning on sets 21:30 / 07:00; two `TimeInput`s "From" / "To"; `Switch` "Security alerts still send" bound to `quiet_security`) and **App address** card (icon `link`; "Used for the link in each ping."; `TextInput` placeholder = `app_address_default ?? 'http://chores.local'`, saved on blur). Empty state when no places: `EmptyState` icon `notifications`, title "No places yet", body "Add a Signal group, Discord channel, email or any Apprise address." `PlaceForm` (Mantine `Modal`, title "Add a place"/"Change address"): `TextInput` "Name" (max 60), `TextInput` "Apprise address" (max 1000, description "Like discord://webhook_id/token. See the Apprise wiki for your app."), Save. Test result: ok → `toastOk('Test sent')`; else `toastFail(new Error(error))`.

- [x] **Step 1: Write the failing tests** (mock `@/v2/api` like `tests/v2/bell.test.tsx`): renders a place's name and mask, never a raw URL; clicking the "Kid note" chip PATCHes `/notify/places/1` with `events` including `kid_note`; "Test" with `{ok:false,error:'401 Unauthorized'}` shows that text; empty list shows "No places yet"; "Add a place" → fill → Save POSTs `{name, url}`; Settings list renders a "Notifications" link to `/settings?section=notifications`.
- [x] **Step 2: Run** `npx jest tests/v2/notificationsPane.test.tsx` → FAIL.
- [x] **Step 3: Implement** the hooks, components and the three modifications. Keep each file < 200 lines.
- [x] **Step 4: Run** → PASS; frontend CI (`npx tsc --noEmit && npm run lint && npx jest`).
- [x] **Step 5: Commit** `feat(settings): notifications pane with apprise places and quiet hours`.

---

### Task 9: Bell to §3.7

**Files:**
- Create: `frontend/src/v2/components/bellRules.ts`, `frontend/src/v2/components/BellActions.tsx`, `frontend/src/v2/components/NotificationsPage.tsx`, `frontend/pages/notifications.tsx`
- Modify: `frontend/src/v2/components/Bell.tsx`, `frontend/src/v2/components/bell.css`, `frontend/src/v2/hooks/useInbox.ts`, `frontend/src/v2/osNotify.ts`, `frontend/src/v2/types.ts` (`NeedsItem.type` adds `'note'`, `note?: string`), `frontend/src/v2/today/NeedsYouList.tsx`
- Test: `frontend/tests/v2/bell.test.tsx` (extend), `frontend/tests/v2/bellRules.test.ts`, `frontend/tests/v2/needsYouList.test.tsx`

**Interfaces:**
- Consumes: Task 7 fields.
- Produces:
  - `InboxItem` gains `kid_id: number | null; kid_name: string | null; glyph: string | null; pending: boolean`.
  - `bellRules.ts`: `ALERT_KINDS = ['device_resisting','device_bypass','box_offline']`; `isNeedsYou(n): boolean` = `n.pending && ['chore_submitted','redemption_request','chore_note'].includes(n.kind)`; `isAlert(n): boolean`; `severity(n): {name: string; tone: 'hi'|'md'|'lv'|'ok'}` — resisting/bypass `gpp_maybe` hi · box_offline `router` hi · new_device `device_unknown` md · chore_note `glyph ?? 'flag'` md · chore_submitted `glyph ?? 'task_alt'` lv · redemption_request `redeem` lv · level_up `military_tech` ok · badge_earned `workspace_premium` ok · default `notifications` ok; `when(iso: string, now = new Date()): string` — same day → `toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})`, yesterday → `'Yesterday'`, else `toLocaleDateString([], {weekday:'short', day:'numeric'})`; `isToday(iso)` moved here.
  - `BellActions({ n, busy, ... })` renders, only when `isNeedsYou(n)` or for device/alert kinds: chore_submitted → **Approve +{points}** / **Send back** (existing note flow); redemption_request → **Approve** / **Decline**; chore_note → **Reply** (icon `chat`): `router.push('/?chore=' + run_id)` then `openChat('chore', String(run_id))`; new_device → **Who's this?** (icon `person_add`); resisting/bypass → **View** (icon `devices`) and, when `kid_id`, **Ask {kid_name}** (icon `chat`) → `openChat('private', String(kid_id))`; box_offline → **View** → `/devices`.
  - `List` is exported from `Bell.tsx` with an extra prop `page?: boolean` (full width, no popover chrome).
  - `osNotify.dest`: add `box_offline` → `/devices`.
  - `NeedsYouList`: renders `type: 'note'` items (flag icon, amber tone, `{kid_name}: {note}` under the chore title) with one **Reply** action (icon `chat`) that opens the chore thread (`router.push('/?chore=' + id)` then `openChat('chore', String(id))`, same as the bell's Reply); no Approve or Send back; the empty state only shows when there are no items of any type. The list never decides what a note is: it only renders what the server sent.

Changes in `Bell.tsx` (after moving rules + actions out): drop the `useToday` pending cross-read (use `n.pending`); item sub-line = `[n.body, when(n.created_at)].filter(Boolean).join(' · ')`; Earlier items keep the unread dot when unread (no actions, as in the mockup); footer (parent only, not kid) `<div className="p-bell-foot">` with `Link` "Notification settings" (icon `tune`) → `/settings?section=notifications` and `Link` "See all" (icon `chevron_right` after the text) → `/notifications`, both closing the popover; Popover gets `withArrow` and `position={placement === 'rail' ? 'right-start' : 'bottom-end'}`, arrow styled with the card background + 2px ink border (§2.2). `NotificationsPage` = `RequireParent` + `ParentShell title="Notifications"` + `<List kid={false} onGo={() => {}} page />`; `pages/notifications.tsx` default-exports it.

- [x] **Step 1: Write the failing tests.** `bellRules.test.ts`: `isNeedsYou` true for pending chore_note, false for a read-but-not-pending one; `isAlert` false for `new_device`, true for `device_bypass` and `box_offline`; `severity` returns the item's glyph for chore_submitted; `when` returns "Yesterday" for 24 h ago. `bell.test.tsx` additions: tabs show `All · 3`, `Needs you · 1`, `Alerts · 1` for [pending chore_submitted, read new_device, device_bypass]; a pending `chore_note` shows **Reply**; a `device_bypass` with `kid_id: 4, kid_name: 'Mia'` shows **Ask Mia**; **no actions when not pending** (`chore_submitted` with `pending:false` has no Approve); footer links point to `/settings?section=notifications` and `/notifications`; kid bell has no footer. `needsYouList.test.tsx`: a `type: 'note'` item renders "Mia: stuck on step 3" with a **Reply** button and no Approve; Reply opens the chore thread; a list with only a note item does not show "All caught up". Update existing tests that served `/today` for pending to set `pending` on items instead.
- [x] **Step 2: Run** `npx jest tests/v2/bell.test.tsx tests/v2/bellRules.test.ts` → FAIL.
- [x] **Step 3: Implement.** Check every touched file is < 500 lines (`wc -l`).
- [x] **Step 4: Run** → PASS; frontend CI.
- [x] **Step 5: Visual check.** Start nothing new: use the running demo (frontend dev server already up) and screenshot the bell popover (light + dark) and Settings → Notifications next to `02-parent-screens.html` (bell + `#sp-notif`) and `05-states.html` "Bell · empty". Fix drift in layout, wording, chip/tone colours. Attach the screenshots to the task report.
- [x] **Step 6: Commit** `feat(bell): notes, alerts, inline actions, footer and see-all page`.

---

### Task 10: End-to-end and wrap-up

**Files:**
- Create: `frontend/e2e/notifications.spec.ts`
- Modify: `docs/superpowers/plans/2026-10-25-v3-plan-f-notifications.md` (tick boxes only)

- [x] **Step 1: Write the e2e** (pattern: `e2e/chore-model.spec.ts`, `loginUi`, `parentApi` from `e2e/seed.ts`): parent opens `/settings?section=notifications` → "Add a place" → name `E2E ${tag}`, address `json://127.0.0.1:9/nowhere` → Save → card shows `json://127.…` mask, never the full address → "Test" → an error toast appears → toggle "Badge / level up" chip and reload: still on → set Quiet hours on, reload: "From" shows 9:30 PM → open the bell → footer "See all" lands on `/notifications` → delete the place. Second test: kid leaves a note via API (`/api/proxy/kid/chores/{id}/note` with the kid session, as in `chore-model.spec.ts`), parent bell shows the note under **Needs you** with **Reply**, clicking Reply opens Today with that chore and its chat.
- [x] **Step 2: Run** `npx playwright test e2e/notifications.spec.ts` against the demo (`E2E_BASE_URL` as the other specs use) → PASS. If the demo DB isn't migrated yet (Task 2 note), report BLOCKED instead of migrating it yourself.
- [x] **Step 3: Full CI** both sides; `$V/alembic heads` shows one head.
- [x] **Step 4: Commit** `test(e2e): apprise places and bell notes`.
