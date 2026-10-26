# v3 Plan D — Devices, blocker and hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Named hour rules with many targets (categories, date ranges, precedence), device activity (presence, address changes, bypass, tries while locked, left Wi-Fi, wrong PINs, lock history, alert actions), group icon and chore switch, end to end (data, lock engine, blocker, API, parent UI, setup step 6).

**Architecture:** Migration A (Task 1) adds every table/column and copies `time_windows` into `hour_rules` (+ `hour_rule_times`, `hour_rule_targets`); migration B (Task 2) drops `time_windows` when the lock engine switches over. A new pure module `app/lock/hours.py` turns rules into the `DeviceFacts` window sets (precedence lives here only). A new `app/lock/activity.py` writes `device_events` / `device_presence`; it is called from `tick()`, the internal blocker endpoints and kid login. The blocker counts portal hits per MAC and reports them with its resistance beat. Frontend: new Hours pane + rule editor, setup step 6, group card, device Overview/Network/Activity.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (SQLite, `batch_alter_table`), pytest; Next.js pages router, React Query, Mantine, jest, Playwright (`frontend/e2e`).

**Spec:** `docs/superpowers/specs/2026-10-24-v3-redesign-design.md` §7, §3.3 (Devices, Groups), §3.6 (Hours), §3.9 (setup step 6), §3.10 (clean-activity empty state), §11 errata 2, 3, 6, 8. Mockups `02-parent-screens.html` (Devices Overview/Network/Activity, Groups, Settings → Hours), `04-parent-phone.html` (Device → Activity), `05-states.html` (Device activity · clean), `07-setup.html` (step 6 + Edit hours). Owner addendum (binding, 2026-10-25): **named hour rules with many targets** — create once, tick any kids and/or groups, editing the rule updates every target.

**Repo:** `/home/user/code/tskfrce-v3a`, branch `feat/v3-parent-restyle`. `V=/home/user/code/tskfrce-redesign/.venv/bin`.

## Global Constraints

- Files under 500 lines (aim < 300); split before crossing.
- Semantic commits ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add <own files>` only (another agent shares this checkout); never `git add -A`/`.`. On `index.lock`, wait and retry. Don't push.
- Before each commit: backend `cd backend && $V/ruff format --check . && $V/ruff check . && $V/python -m pytest tests -q`; blocker (Task 7) `cd /home/user/code/tskfrce-v3a && $V/python -m pytest blocker/tests -q`; frontend `cd frontend && npx tsc --noEmit && npm run lint && npx jest`. `ruff format <file>` on your own files is fine. **Never run prettier.**
- A demo backend runs from this checkout with `--reload`. Don't stop or restart it. After Task 1 is committed, migrate the demo DB right away (it will crash on the new models otherwise): `DATA_DIR=$(tr '\0' '\n' < /proc/$(pgrep -f 'uvicorn.*app.main' | head -1)/environ | sed -n 's/^DATA_DIR=//p') $V/alembic -c backend/alembic.ini upgrade head` (run from repo root; if the process has no DATA_DIR, ask the controller).
- Parent UI uses `--p-*` tokens, `Chip`, `Icon` (Material Symbols names), `p-btn`, `pk-panel`; no emojis. No neon text or thin neon bars on light backgrounds (§2.4): light mode bars/indicators use ink on `#e4e4e1`. Copy hour-pattern CSS (`.pt`, `.pt-school`, `.pt-week`, `.pt-holi`, `.pt-summer`, `.pt-kid`, `.pt-group`, `.tl3`, `.ax3`, `.legend2`, `.prec`) and activity CSS (`.kpis`, `.al`, `.sev`) from mockup 02, translated to `--p-*` tokens.
- Copy is plain, sentence case; API `detail` strings are full sentences.
- `days` strings: digits `0`=Mon … `6`=Sun (unchanged). School nights = Sun–Thu = `"01236"`; Weekends = Fri–Sat = `"45"`. The editor shows day buttons Sun-first (`S M T W T F S` → digits `6 0 1 2 3 4 5`).
- Rule categories and rank: `holiday` 0, `summer` 1, `weekend` 2, `school_night` 3, `other` 4. Tier: `holiday`/`summer` = tier 0, everyday (`weekend`, `school_night`, `other`) = tier 1. Target rank: kid 0, group 1, everyone 2. Precedence key = (tier, target rank, category rank), lowest wins. Rule kinds: `allowed` (online only inside these times), `free` (online without chores), `off` (internet off inside these times).
- Hour pattern textures: School nights = diagonal stripes, Weekends = solid, Holidays = dots, Summer = vertical lines, Per child = crosshatch + kid initial, Per group = horizontal lines. Precedence line copy: **Holiday and Summer › Per child › Per group › Everyone**.
- Omit (errata): "Exempt school devices during homework", "Block new devices that look similar", "Data used today".
- Plan F owns Apprise/bell; parent pings here use the existing inbox only. Plan C owns ntfy and its blocker allow-list.
- Alembic: migration A's `down_revision` is whatever `$V/alembic -c backend/alembic.ini heads` prints when you start Task 1 (k4d5e6f7a8b9 today; Plan C may add one first). Migration B's is A. There must be exactly one head afterwards.

## Owner decisions (2026-10-26)

1. **Precedence changed.** Holiday and Summer date-range rules ALWAYS win over everyday categories (school night, weekend, other). Within the same tier the order is kid > group > everyone. Supersedes the old "per child beats holiday" rule. Owned by Task 2 (`hours.resolve` + tests); the precedence-line copy changes in Task 9. New test: a family Holiday beats a kid's own School-night rule on a holiday date.
2. **Holiday dates** are fixed dates, not repeated yearly (Decision 6 stands).
3. **Exempt device.** New per-device boolean `exempt` (default false) = never locked: skips hours and the chore check (a manual lock still applies). Migration (Task 1), lock logic (Task 2), device API (Task 3, 6), Device Overview switch "Always allowed (never lock)" (Task 12), device list "Exempt" chip and DeviceList glyph state (Task 12): after the manual-lock check, tone grey, icon `verified_user`, tip "Exempt · always allowed".
4. **Defaults accepted as planned:** "internet off" rule kind, exempt from precedence (Decisions 3, 4); group "Lock with the kids' chores" meaning plus the family switch (Decision 8); DNS lookups not counted and no "opened N times" sub-count (Decision 9); one timeline row per rule, no merging (Decision 11).

## Decisions taken (owner answers applied, see above)

1. **Rules replace windows.** `time_windows` becomes `hour_rules` (name, category, kind, days, optional `start_date`/`end_date`, `everyone`) with many `hour_rule_times` and many `hour_rule_targets` (kid or group). `/api/v1/windows` is removed; `/api/v1/hours` replaces it.
2. **Family-wide = explicit "Everyone"** (`everyone=true`): applies to every kid-owned device. A rule must have Everyone *or* at least one kid/group, not both.
3. **"Internet off" is a third kind** (`off`), from the owner's "Homework time … internet off" example.
4. **Precedence picks among `allowed` rules only.** `free` and `off` rules always add on top. So "Homework time · off" for Mia does not wipe the family school-night hours for Mia.
5. **Precedence (owner, 2026-10-26):** key = (tier, target rank, category rank), lowest wins, on the family-local date. Holiday and Summer date-range rules always beat everyday rules (school night, weekend, other), even a kid's own. Within a tier: kid > group > everyone (erratum 8).
6. **Dates are absolute** (`2026-12-20` to `2027-01-03`), not yearly-repeating. Holidays and summer require both dates.
7. **Migration merges identical windows:** rows with the same (kind, days, set of times) become one rule targeting all their kids/groups.
8. **"Lock with the kids' chores"** (group switch, default on): off = devices in that group skip the chore check (hours and manual locks still apply). Family switch "Lock until today's chores are done" (`chores_lock`, default on) does the same for every device.
9. **Tries while locked / outside hours** = portal HTTP hits from a blocked device, at most one per device per 10 s, merged into one alert per 30 min. DNS queries are not counted (background noise). The mockup's "lock page opened N times" sub-count is dropped.
10. **"Same device, merge"** keeps the older device (name, owners, groups) and moves the new MAC/addresses onto it; the new row is deleted.
11. **Hours timeline shows one row per rule**, family rules first in category order, then group rules, then kid rules.
12. **Presence** = one row per device per 10-minute UTC slot while the box sees it (`locked` = it was blocked then). Kept 8 days; events kept 30 days.

## Review Focus

1. Upgrading a box whose setup made one identical window per kid → one rule with all kids, and `desired_blocked` gives the same answer before and after. → Task 1 `test_migration_merges_windows`, Task 2 `test_rule_matches_old_window_behaviour`.
2. An `off` rule targeted at a kid never removes that kid's family allowed hours. → Task 2 `test_off_rule_does_not_replace_allowed`.
3. A holiday across New Year in a non-UTC family zone applies by the family-local date, and stops the day after it ends. → Task 2 `test_holiday_across_new_year_local_date`.
4. Deleting a kid or group that a rule targets keeps the rule and its other targets; a rule left with no target is inert (never "everyone"). → Task 3 `test_delete_target_keeps_rule`.
5. Editing a rule with two kid targets re-evaluates both kids' devices; a PATCH of a group from the device screen (name + device_ids only) must not reset its icon or chore switch. → Task 3 `test_put_rule_updates_every_target`, `test_group_patch_keeps_icon`.
6. Precedence: a family Holiday beats a kid's own School-night rule on a holiday date; within a tier kid > group > everyone. → Task 2 `test_family_holiday_beats_kid_school_night`, `test_kid_beats_group_beats_everyone_same_tier`.
7. An exempt device is online outside hours with chores undone, but a manual lock still blocks it. → Task 2 `test_exempt_device_never_locked`.

---

### Task 1: Migration and models

**Files:**
- Create: `backend/alembic/versions/p0d1e2f3a4b5_devices_hours_v3.py` (migration A)
- Create: `backend/app/models/hours.py`, `backend/app/models/device_activity.py`
- Modify: `backend/app/models/lock.py` (new columns; `TimeWindow` stays until Task 2), `backend/app/models/family.py`, `backend/app/models/__init__.py`, `backend/app/core/database.py` (model import list), `backend/tests/factories.py`
- Test: `backend/tests/test_hours_migration.py` (new), `backend/tests/test_migrations.py` (existing parity test)

**Interfaces — Produces:**
- `HourRule(id, name String(60), category String(14) CHECK in 5 categories, kind String(10) CHECK allowed|free|off, days String(7), start_date Date null, end_date Date null, everyone Bool default False)`; relationships `times` (order_by start, cascade all/delete-orphan) and `targets` (cascade all/delete-orphan); read-only properties `kid_ids: list[int]`, `group_ids: list[int]`.
- `HourRuleTime(id, rule_id FK hour_rules ondelete CASCADE, start String(5), end String(5))`.
- `HourRuleTarget(id, rule_id FK CASCADE, kid_id FK users ondelete CASCADE null, group_id FK device_groups ondelete CASCADE null)`, CHECK `(kid_id IS NULL) != (group_id IS NULL)` name `ck_rule_target_one`, UNIQUE(rule_id, kid_id, group_id).
- `DeviceEvent(id, device_id FK devices CASCADE index, kind String(16) CHECK in KINDS, at DateTime index, last_at DateTime null, count Int default 1, reason String(16) null, kid_id FK users SET NULL null, by_id FK users SET NULL null, other_device_id FK devices SET NULL null, minutes Int null, detail String(120) null, reviewed_at DateTime null)`. In the same module: `KINDS = ("bypass","new_address","outside_hours","locked_try","left_wifi","sign_in","address_change","locked","unlocked")`, `ALERT_KINDS = KINDS[:6]`, `FILTERS = {"bypass": ("bypass","new_address"), "locked": ("locked_try","outside_hours","left_wifi"), "sign_in": ("sign_in",)}`.
- `DevicePresence(device_id FK devices CASCADE, slot DateTime, locked Bool)`, PK (device_id, slot).
- `DeviceGroup.icon String(40) NOT NULL server_default 'devices'`, `DeviceGroup.chore_lock Bool NOT NULL server_default '1'`; `Device.blocked_since DateTime null`, `Device.exempt Bool NOT NULL server_default '0'` (never locked); `FamilySettings.chores_lock Bool NOT NULL server_default '1'`.
- `tests/factories.py`: `make_rule(db, *, kind="allowed", days="0123456", times=(("00:00","23:59"),), kid_ids=(), group_ids=(), everyone=False, category="other", start_date=None, end_date=None, name="Hours") -> HourRule` (adds, commits).

- [ ] **Step 1:** Write `test_migration_merges_windows` in `tests/test_hours_migration.py` (copy the subprocess `alembic upgrade` pattern from `test_migrations.py`): upgrade a temp DB to the previous head, insert users kid A, kid B, group G and `time_windows` rows: A allowed `0123456` 07:00–21:00; B allowed `0123456` 07:00–21:00; A free `45` 10:00–12:00; G allowed `01236` 06:00–08:00 and G allowed `01236` 15:00–20:00. Upgrade to head. Assert exactly 3 rules: (`Online hours`, other, allowed, `0123456`, targets kids {A,B}, times [07:00–21:00]); (`Weekends`, weekend, free, `45`, kid {A}, [10:00–12:00]); (`School nights`, school_night, allowed, `01236`, group {G}, [06:00–08:00, 15:00–20:00]); all rules `everyone = 0`; `time_windows` rows untouched.
- [ ] **Step 2:** Write `test_downgrade_a_drops_rules`: upgrade to A, downgrade one step → the new tables/columns (including `devices.exempt`) are gone, `time_windows` still has its 5 rows. Also assert in `test_migration_merges_windows` that existing devices get `exempt == 0`.
- [ ] **Step 3:** Run `$V/python -m pytest tests/test_hours_migration.py -q` → FAIL.
- [ ] **Step 4:** Write the migration. Create the 5 tables, add the 5 columns (`batch_alter_table`, includes `devices.exempt`). Convert in Python (no app imports):
  ```python
  # 1. per target: (kind, days) -> sorted tuple of (start, end)
  # 2. signature (kind, days, times) -> list of targets; one rule per signature
  CAT = {frozenset("01236"): "school_night", frozenset("45"): "weekend"}
  NAME = {"school_night": "School nights", "weekend": "Weekends"}
  category = CAT.get(frozenset(days), "other")
  name = NAME.get(category) or ("Free time" if kind == "free" else "Online hours")
  ```
  Insert rules ordered by first window id. Keep `time_windows` (Task 2 drops it). Downgrade drops the new tables/columns.
- [ ] **Step 5:** Add the models and columns. Add `make_rule` to `tests/factories.py`. Nothing reads the rules yet; the app still runs on `time_windows`.
- [ ] **Step 6:** Run `$V/python -m pytest tests -q` → PASS (full suite unchanged).
- [ ] **Step 7:** Commit `feat(hours): hour rules, device activity tables and migration from windows`. Then migrate the demo DB (Global Constraints).

### Task 2: Hours engine and lock facts

**Files:**
- Create: `backend/app/lock/hours.py`, `backend/alembic/versions/p1d2e3f4a5b6_drop_time_windows.py` (migration B)
- Delete: `backend/app/api/windows.py` (and its `main.py` include); `TimeWindow` from `models/lock.py`, `models/__init__.py`, `core/database.py`
- Modify: `backend/app/lock/rules.py`, `backend/app/lock/state.py`, `backend/app/lock/schedule.py` (delete `window_end` once unused), `backend/app/api/family.py` (`_locks_at`), `backend/app/api/kids.py` (kid delete), `backend/app/api/devices.py` (group delete)
- Test: `backend/tests/lock/test_hours.py` (new), `backend/tests/lock/test_rules.py`, `backend/tests/lock/test_state.py`, and every test still using `TimeWindow` (`test_e2e_lock.py`, `test_parent_api.py`, `test_lock_models.py`, `test_today_payload.py`, `test_redemptions.py`) → switch to `make_rule`

**Interfaces — Consumes:** Task 1 models, `Window`, `in_window`, `local_now`.
**Interfaces — Produces:**
- `hours.CATEGORY_RANK: dict[str, int]` (Global Constraints).
- `@dataclass(frozen=True) RuleView(id, category, kind, days: frozenset[int], start_date: date|None, end_date: date|None, everyone: bool, kid_ids: frozenset[int], group_ids: frozenset[int], windows: tuple[Window, ...])`.
- `hours.load(db) -> list[RuleView]` (one query + `selectinload` of times and targets).
- `hours.active_on(r: RuleView, d: date) -> bool`: `d.weekday() in r.days` and within the optional dates (inclusive).
- `hours.resolve(rules, owner_ids: set[int], group_ids: set[int], d: date) -> Resolved` where `Resolved(NamedTuple): allowed_sets: tuple[tuple[Window, ...], ...]; free: tuple[Window, ...]; off: tuple[Window, ...]`. Algorithm (write exactly this):
  ```python
  matched = []
  for r in rules:
      if not active_on(r, d):
          continue
      keys = {("kid", k) for k in r.kid_ids & owner_ids} | {("group", g) for g in r.group_ids & group_ids}
      if r.everyone and owner_ids:
          keys.add(("all", 0))
      if keys:
          matched.append((r, keys))
  free = tuple(w for r, _ in matched if r.kind == "free" for w in r.windows)
  off = tuple(w for r, _ in matched if r.kind == "off" for w in r.windows)
  allowed = [(r, k) for r, k in matched if r.kind == "allowed"]
  def rank(r, keys):
      t = 0 if any(k[0] == "kid" for k in keys) else 1 if any(k[0] == "group" for k in keys) else 2
      tier = 0 if r.category in ("holiday", "summer") else 1   # date-range rules always win
      return (tier, t, CATEGORY_RANK[r.category])
  if not allowed:
      return Resolved((), free, off)
  best = min(rank(r, k) for r, k in allowed)
  sets: dict = {}
  for r, keys in allowed:
      if rank(r, keys) == best:
          for k in keys:
              sets.setdefault(k, []).extend(r.windows)
  return Resolved(tuple(tuple(v) for v in sets.values()), free, off)
  ```
  (ponytail: rules are picked by the local calendar date; an overnight tail after midnight follows the next day's pick.)
- `hours.locks_at(allowed_sets, off, now_local: datetime) -> datetime | None`: first whole minute within 24 h where hours stop allowing (some set doesn't cover it, or an `off` window does); None if hours don't allow now or never stop. Minute scan like the old `window_end`.
- `hours.today_category(rules, d) -> str | None`: lowest-rank category among `everyone` + `allowed` rules active on `d`.
- `DeviceFacts` gains (appended, with defaults) `off: tuple[Window, ...] = ()`, `chores_apply: bool = True`. `exempt: bool = False`. `is_online`: after the guest/unassigned early returns and the manual-lock check (a manual lock still wins), `if f.exempt: return True`; then `if any(in_window(w, now) for w in f.off): return False`; `chores_ok = not f.chores_apply or all(...)`.
- `rules.block_reason(f, now_local) -> str | None`: None when online; else first of `"manual"` (override lock), `"new_device"` (unassigned), `"schedule"` (off window or allowed sets fail), `"chores"`.
- `rules.open_reason(f, now_local) -> str | None`: None when blocked; else first of `"guest"`, `"unassigned"`, `"exempt"`, `"chores"` (chores_apply, some owner total > 0, all done), `"schedule"` (not chores_apply or every total == 0), `"free_time"`, `"manual"` (override unlock), `"bonus"`.
- `Prefetch.rules: list[RuleView]` replaces `Prefetch.windows`. `device_facts` uses `hours.resolve(pre.rules if pre else hours.load(db), {o.id for o in device.owners}, {g.id for g in device.groups}, local_now(fam.timezone, now_utc).date())` and sets `exempt = device.exempt` and `chores_apply = fam.chores_lock and all(g.chore_lock for g in device.groups)`.
- `family._locks_at(pre, kid_id, now_local)`: `r = hours.resolve(pre.rules, {kid_id}, set(), now_local.date())`, then `hours.locks_at(r.allowed_sets, r.off, now_local)`.
- Kid delete: `db.query(HourRuleTarget).filter_by(kid_id=kid.id).delete()`; group delete: same with `group_id`.

- [ ] **Step 1:** Tests in `tests/lock/test_hours.py` (pure, build `RuleView`s with a small helper): `test_family_holiday_beats_kid_school_night` (family holiday dated that day 08–23 + kid's own school_night `01236` 15–20 on that date → only the holiday's windows), `test_summer_beats_everyday` (family summer vs kid weekend/other), `test_kid_beats_group_beats_everyone_same_tier` (same category: kid, group and everyone rules → kid's; without kid → group's), `test_holiday_beats_school_night` (family school_night `01236` 15–20 + family holiday all days 08–23 dated that day → allowed set is the holiday's), `test_group_below_kid` (kid rule and group rule both match → only the kid's windows), `test_two_owners_intersect` (kid A rule 15–20, kid B rule 17–22, shared device → two sets), `test_off_rule_does_not_replace_allowed` (family allowed + kid `off` 16–18 → allowed_sets is the family's, `off` has 16–18), `test_dates_inclusive`, `test_everyone_needs_owner` (owner_ids empty → nothing matches), `test_locks_at_off_window` (allowed all day, off at 16:00 → locks_at 16:00).
- [ ] **Step 2a:** In `tests/test_hours_migration.py`: `test_drop_and_restore_windows` — Task 1 data, upgrade to head → `time_windows` gone, rules intact; downgrade one step → `time_windows` rows equal the original 5 (compare sets of (kind, days, start, end, kid_id, group_id)). Migration B downgrade recreates `time_windows` (same columns/checks as `fb864d5a6b5e`) and expands rule × target × time for kinds allowed/free (`everyone` → one row per kid); `off` rules are dropped.
- [ ] **Step 2:** `test_holiday_across_new_year_local_date` in `tests/lock/test_state.py`: family tz `America/New_York`, holiday rule `2026-12-20`–`2027-01-03` 08:00–23:00 everyone, school-night rule 15:00–20:00 everyone; kid device with chores done. At `2027-01-02T14:00Z` (09:00 local, Saturday) → online; at `2027-01-04T14:00Z` (Mon 09:00) → blocked by schedule. Add `test_rule_matches_old_window_behaviour`: one rule targeting two kids 07:00–21:00 gives the same `desired_blocked` at 06:59 and 07:00 local as the old per-kid window tests expected. Add `test_exempt_device_never_locked` (`exempt=True`, outside hours and chores undone → online; with an active manual lock override → blocked; `open_reason == "exempt"`). Add `test_chore_lock_off_skips_chores` (family `chores_lock=False`, chores not done, inside hours → online; same with a group `chore_lock=False`).
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement (migration B, engine, deletions). Port every remaining `TimeWindow(...)` in tests to `make_rule(...)` with the same fields. Leave the `/windows` tests' intent to Task 3 (delete those tests here; Task 3 adds `/hours` tests). After committing, migrate the demo DB again.
- [ ] **Step 5:** Full suite + ruff → PASS. If `tests/test_query_counts.py` fails only because `hours.load` adds the two `selectinload` queries, raise its ceiling by 2 and say so in the commit body.
- [ ] **Step 6:** Commit `feat(lock): hour rule precedence, off windows and chore switches`.

### Task 3: Hours API, family and group fields

**Files:**
- Create: `backend/app/api/hours.py`, `backend/app/schemas/hours.py`
- Modify: `backend/app/main.py` (include router), `backend/app/schemas/lock.py` (`GroupIn`, `FamilyPatch`), `backend/app/api/devices.py` (`_group_out`, create/patch group; device PATCH accepts `exempt`, `device_out` returns it), `backend/app/api/family.py` (GET family adds `chores_lock`), `blocker/tests/lab/test_journey_economy.py` (`/windows` → `/hours`)
- Test: `backend/tests/test_hours_api.py` (new), `backend/tests/test_parent_api.py`

**Interfaces — Produces:**
- `TimeRange {start: HH:MM, end: HH:MM}`; start == end → 422 "Start and end can't be the same."
- `RuleIn {name 1–60, category Literal[5], kind Literal["allowed","free","off"], days (same validator as old `WindowIn._days`), start_date: date|None, end_date: date|None, everyone: bool=False, kid_ids: list[int]=[], group_ids: list[int]=[], times: list[TimeRange] 1–6}`.
- Cross-field errors (raise `HTTPException(422, …)` in the route helper `_check(db, body)`):
  - holiday/summer missing a date → "Holidays and summer need a first and last day."
  - exactly one date given → "Give both a first and last day, or neither."
  - end before start → "The last day can't be before the first day."
  - everyone with kids/groups → "Pick Everyone or some kids and groups, not both."
  - no everyone and no targets → "Pick who this is for."
  - unknown kid → 404 "That kid doesn't exist. Pick a kid from the list."; unknown group → 404 "That group doesn't exist. Pick a group from the list."
- `RuleOut {id, name, category, kind, days, start_date: "YYYY-MM-DD"|null, end_date, everyone, kid_ids: list[int], group_ids: list[int], times: [{start, end}]}`.
- Routes (parent only, prefix `/api/v1/hours`), each write ends `db.commit(); trigger()`:
  - `GET ""` → `{"today": hours.today_category(rules, family-local date), "rules": [RuleOut]}` ordered by id (the frontend sorts).
  - `POST ""` → RuleOut. `PUT "/{id}"` body RuleIn → replaces fields, times and targets → RuleOut. `DELETE "/{id}"` → `{"ok": true}`. Missing id → 404 "That rule doesn't exist. Refresh and try again."
- `GroupIn {name, device_ids=[], icon: str|None (1–40) = None, chore_lock: bool|None = None}`; None keeps the current value (create: `"devices"` / True). `_group_out` adds `icon`, `chore_lock`.
- Device patch schema gains `exempt: bool | None` (None keeps); `device_out` always returns `exempt`.
- `FamilyPatch.chores_lock: bool | None`; GET `/family` returns `chores_lock`.

- [ ] **Step 1:** Tests in `test_hours_api.py`: `test_create_rule_many_targets` (POST "Homework time", other, off, `01234`, 16:00–18:00, kid_ids [A,B], group_ids [G] → 200, GET lists it with all three targets), `test_put_rule_updates_every_target` (rule allowed 00:00–23:59 for kids A and B, each with a device and chores done → both online; PUT times to a window that excludes now → `desired_blocked` contains both MACs), `test_rule_validation` (one parametrized test over the six 422/404 cases above, asserting each exact `detail`), `test_today_category` (freeze time with the existing monkeypatch pattern; family school_night rule active today → `today == "school_night"`), `test_delete_target_keeps_rule` (rule for kid A + kid B; delete kid A via the existing kid-delete route → rule still listed with `kid_ids == [B]`; delete B too → rule listed with `kid_ids == []`, `everyone == false`, and a device owned by nobody-in-rule is unaffected), `test_kid_cannot_edit_hours` (kid token → 403).
- [ ] **Step 2:** In `test_parent_api.py`: `test_group_icon_and_chore_lock` (POST group with `icon: "tv"`, `chore_lock: false` → echoed), `test_group_patch_keeps_icon` (PATCH with only name + device_ids → icon/chore_lock unchanged), `test_family_chores_lock` (PATCH false → GET false), `test_device_exempt_patch` (PATCH `exempt: true` → echoed in GET `/devices`; a PATCH of other fields keeps it; default false).
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement; update the lab journey test to create a rule via `/api/v1/hours` (same window, `kid_ids: [kid]`, `category: "other"`, `name: "Lab hours"`) and delete it in cleanup.
- [ ] **Step 5:** Full suite + ruff → PASS. **Step 6:** Commit `feat(hours): hour rules API, group icon and chore switches`.

### Task 4: Lock transitions, lock history, left Wi-Fi, pruning

**Files:**
- Create: `backend/app/lock/activity.py`
- Modify: `backend/app/lock/state.py` (`tick`)
- Test: `backend/tests/lock/test_activity.py` (new)

**Interfaces — Consumes:** `DeviceEvent`, `DevicePresence`, `Device.blocked_since`, `block_reason`, `open_reason`, `is_online`, `device_facts`.
**Interfaces — Produces (all in `app/lock/activity.py`; times are naive UTC; callers commit):**
- `SLOT = timedelta(minutes=10)`.
- `def log(db, device_id: int, kind: str, now: datetime, *, merge_minutes: int | None = None, count: int = 1, **fields) -> DeviceEvent`: with `merge_minutes`, find the newest event of the same device + kind (+ same `kid_id` when given) whose `coalesce(last_at, at) >= now - merge_minutes`; if found add `count`, set `last_at = now` and return it. Otherwise create one with `at = now`, `last_at = now if merge_minutes else None`, `count`, `**fields`.
- `def record_transitions(db, rows: list[tuple[Device, DeviceFacts]], now: datetime, now_local: datetime) -> None`:
  - blocked and `blocked_since is None` → set it to `now`; `log(kind="locked", reason=block_reason(...))`; when reason is `manual`, also `by_id` and `minutes` from the newest live manual override (`minutes = round((expires_at - created_at) / 60s)` or None).
  - online and `blocked_since` set → clear it; `log(kind="unlocked", reason=open_reason(...))`, plus `by_id`/`minutes` when reason is `manual`.
  - Left Wi-Fi: for each `status == "assigned"` device still blocked, when `now >= blocked_since + 5 min`, `last_seen` is not None, `blocked_since - 5 min <= last_seen <= blocked_since + 2 min`, and no `left_wifi` event has `at >= blocked_since` → `log(kind="left_wifi", minutes=max(0, round((last_seen - blocked_since) / 60s)))`.
- `def prune(db, now) -> None`: delete presence with `slot < now - 8 days`, events with `at < now - 30 days`. Module global `_last_prune`; no-op if called within the last hour.
- `tick()` builds `rows = [(d, device_facts(db, d, fam, now_utc)) for d in devices]` once, derives the blocked MAC list from them (same order/sorting as today), calls `record_transitions` and `prune`, commits, returns the list. `desired_blocked` is unchanged (no logging).

- [ ] **Step 1:** Tests: `test_lock_and_unlock_logged` (kid device, chores todo → tick → one `locked` event reason `chores`, `blocked_since` set; approve chores → tick → `unlocked` reason `chores`, `blocked_since` None; third tick logs nothing), `test_manual_lock_records_who` (set_override lock 30 min by parent → tick → `locked` reason `manual`, `by_id == parent.id`, `minutes == 30`), `test_left_wifi` (device blocked at T, last_seen T+60s; tick at T+4 min → no event; tick at T+6 min → one `left_wifi` with `minutes == 1`; another tick → still one), `test_left_wifi_not_when_seen` (last_seen T+5 min → none), `test_prune` (presence 9 days old and event 31 days old deleted; fresh kept).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Full suite → PASS (existing `tests/lock/test_state.py` tick tests must still pass unchanged).
- [ ] **Step 5:** Commit `feat(lock): log lock history and left-Wi-Fi alerts`.

### Task 5: Blocker reports — presence, address changes, new address, bypass, hits, wrong PINs

**Files:**
- Modify: `backend/app/api/internal.py`, `backend/app/api/kid.py` (login), `backend/app/lock/activity.py`
- Test: `backend/tests/test_internal_activity.py` (new), `backend/tests/test_kid_api.py`

**Interfaces — Consumes:** `activity.log`, `block_reason`, `device_facts`.
**Interfaces — Produces:**
- `activity.sample(db, device: Device, now) -> None`: insert `DevicePresence(device_id, slot=now floored to 10 min, locked=device.blocked_since is not None)` with SQLite `insert(...).on_conflict_do_nothing()`.
- `POST /internal/devices/seen` additionally: (a) existing device whose stored `ip` is not None and differs from the report's `ip` → `log(kind="address_change", detail=f"{old} → {new}")`; (b) `sample()` every report; (c) brand-new device with a hostname → find another device with the same hostname (case-insensitive) and `blocked_since >= now - 10 min`; if found `log(that_device.id, "new_address", other_device_id=new.id, minutes=round((now - blocked_since) / 60s))`.
- `POST /internal/devices/resisting`: when a device is newly flagged → `log(kind="bypass")` (`last_at` None = ongoing); when cleared → newest `bypass` event of that device with `last_at is None` gets `last_at = now`.
- `POST /internal/devices/hits` (require_token, calls `_touch`) body `HitsReport {hits: dict[str, int]}` (≤ 1000 keys, MAC-validated like `ResistingReport`, values 1–10000). For each known device with `blocked_since` set: `reason = block_reason(device_facts(...), now_local)`; `log(kind="outside_hours" if reason == "schedule" else "locked_try", merge_minutes=30, count=n, reason=reason)`. Unknown or unblocked MACs are ignored. Returns `{"logged": int}`.
- Kid login wrong PIN (the 401 branch) with a known request device → `log(dev.id, "sign_in", now, merge_minutes=10, kid_id=kid.id)`; commit before raising.

- [ ] **Step 1:** Tests in `test_internal_activity.py` (use the existing internal-token fixture/pattern from `test_internal_api.py`): `test_seen_samples_presence` (two reports in the same 10 min → one presence row), `test_address_change_logged` (report ip .40 then .42 → one `address_change` with detail `192.168.1.40 → 192.168.1.42`; first-ever ip → none), `test_new_address_after_lock` (device "Mias-iPad" blocked 2 min ago; new MAC reports hostname `mias-ipad` → `new_address` on the old device, `other_device_id` = new id, `minutes == 2`; same with a lock 15 min ago → none), `test_bypass_open_and_close`, `test_hits_merge_and_reason` (blocked by schedule → `outside_hours`; two reports 5 min apart → one event `count` summed; blocked by chores → `locked_try` reason `chores`; unknown MAC → `logged == 0`), `test_hits_requires_token`.
- [ ] **Step 2:** In `test_kid_api.py`: `test_wrong_pin_logged_per_device` (shared device, kid B has a PIN; two wrong PINs from the device IP → one `sign_in` event `count == 2`, `kid_id == B`).
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. **Step 5:** Full suite + ruff → PASS.
- [ ] **Step 6:** Commit `feat(devices): log presence, address changes, bypass, tries and wrong PINs`.

### Task 6: Device activity API and alert actions

**Files:**
- Create: `backend/app/api/device_activity.py`
- Modify: `backend/app/api/devices.py` (`device_out`, `list_devices`, `delete_device`), `backend/app/lock/activity.py`, `backend/app/main.py`
- Test: `backend/tests/test_device_activity_api.py` (new)

**Interfaces — Produces:**
- `activity.device_stats(db, now, ids: list[int] | None = None) -> dict[int, tuple[int, int]]`: device id → (unreviewed `ALERT_KINDS` events in 7 days, `address_change` events in 7 days); two grouped queries.
- `device_out(..., stats=None)` adds `reason` (block_reason or open_reason), `chores_done`, `chores_total` (summed over owners from the facts), `locks_at` (UTC Z from `hours.locks_at`, None for guest/unassigned/exempt), `alerts`, and with `addresses=True` also `address_changes`, `blocked_since`. `list_devices` passes `stats=device_stats(db, now)`.
- `delete_device` also deletes the device's events and presence and nulls `other_device_id` pointing at it.
- Routes (parent only, prefix `/api/v1`):
  - `GET /devices/{id}/activity` → `{"counts": {"bypass", "locked_tries", "outside_hours", "wrong_pins"}, "events": [EventOut], "history": [EventOut], "days": [{"date": "YYYY-MM-DD", "slots": str, "online_minutes": int}]}`. Counts over 7 days: bypass = number of `bypass` events; the other three = summed `count` of `locked_try` / `outside_hours` / `sign_in`. `events` = `ALERT_KINDS` in 7 days, newest first, max 50. `history` = `locked`/`unlocked`, newest first, max 20. `days` = 7 family-local days, today first; `slots` is 144 chars, index = local minute // 10, `o` online / `l` locked / `.` no sample; `online_minutes = 10 × count('o')`.
  - `EventOut {id, kind, at, last_at, count, reason, kid_id, kid_name, by_name, other_device_id, other_device_name, minutes, detail, reviewed: bool}` (names = `full_name or username`).
  - `POST /devices/{id}/events/{eid}/ok` → sets `reviewed_at` → `{"ok": true}`. Unknown/foreign event → 404 "That alert doesn't exist. Refresh and try again."
  - `POST /devices/{id}/events/{eid}/merge` → only `new_address` with a live `other_device_id`, else 409 "This alert can't merge devices." Extract `_purge_device(db, d)` from `delete_device` (owners, overrides, group links, events, presence, other_device_id refs, row) and use it on the other device, `flush()`, then copy its `mac`, `ip`, `ipv6`, `hostname`, `last_seen` onto this device, mark the event reviewed, commit, `trigger()`; returns `device_out(..., addresses=True)`.
  - `POST /kids/{kid_id}/override` body `OverrideIn` → `set_override` on every device the kid owns; not a kid → 404 "That kid doesn't exist. Pick a kid from the list."; no devices → 409 "{name} has no devices yet."; commit, `trigger()`, `{"ok": true, "devices": n}`.

- [ ] **Step 1:** Tests: `test_activity_counts_and_feed` (seed events of each kind, one older than 7 days → counts exclude it; feed newest first; history only lock kinds), `test_activity_days_slots` (family tz `America/New_York`; presence at 13:00Z and 13:10Z locked → today's slots index 54 is `o`, 55 is `l` (09:00/09:10 local), `online_minutes == 10`), `test_mark_ok_clears_alert_count` (`/devices` `alerts` 1 → 0), `test_merge_new_address` (old device with owner A and name "Mia's iPad"; new device MAC m2 → after merge one device, name and owners kept, `mac == m2`, event reviewed), `test_merge_wrong_kind_409`, `test_lock_all_kid_devices` (kid with 2 devices → both get a manual lock override; kid without devices → 409 copy), `test_exempt_device_out` (exempt device outside hours → `reason == "exempt"`, `locks_at` None), `test_device_out_reason_and_locks_at` (inside a 15:00–20:00 rule with chores 1/2 → `reason == "chores"`, `chores_done == 1`, `chores_total == 2`, `locks_at` = 20:00 local in UTC Z).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Full suite + ruff → PASS (`test_query_counts` still within its ceiling).
- [ ] **Step 5:** Commit `feat(devices): activity feed, presence days, merge and lock-all-devices`.

### Task 7: Blocker counts portal hits

**Files:**
- Create: `blocker/hits.py`
- Modify: `blocker/portal.py` (`PortalHTTP`, `run_http`), `blocker/service.py`, `blocker/backend.py`
- Test: `blocker/tests/test_hits.py` (new), `blocker/tests/test_portal.py`, `blocker/tests/test_service.py`, `blocker/tests/test_backend.py`

**Interfaces — Produces:**
- `class HitCounter(resolve: Callable[[str], str | None], clock: Callable[[], float] = time.monotonic, gap: float = 10.0)`: `add(ip: str) -> None` (resolve to MAC; ignore None; count only if `clock() - last[mac] >= gap`); `drain() -> dict[str, int]` (returns and clears counts). Thread-safe (`threading.Lock`).
- `PortalHTTP.on_hit: Callable[[str], None] | None = None`, called with `self.client_address[0]` before redirecting (exceptions swallowed). `run_http(cfg, stop, on_hit=None)`.
- `Service._ip_mac: dict[str, str]` rebuilt in `_apply` from the final `devs` (`t.ip` and each `t.ip6` → mac); `Service._mac_for_ip(ip) -> str | None`; `Service.hits = HitCounter(self._mac_for_ip)`; `start()` passes `on_hit=self.hits.add` to `run_http`.
- `backend.report_hits(cfg, hits: dict[str, int]) -> bool` → POST `/devices/hits` `{"hits": hits}`; never raises.
- `_resist_once` also: `h = self.hits.drain(); if h: report_hits(self.cfg, h)` (inject `report_hits` via a constructor arg `report_hits=` like `report=`).

- [ ] **Step 1:** Tests: `test_hits.py` — `test_gap_dedupes` (3 adds within 10 s fake clock → 1; after 10 s → 2), `test_unknown_ip_ignored`, `test_drain_clears`. `test_portal.py` — handler calls `on_hit` with the client IP and still answers 302. `test_service.py` — after `_apply` with a blocked device at 192.168.1.42, `_mac_for_ip("192.168.1.42")` is its MAC; `_resist_once` sends drained hits through the injected `report_hits` and skips it when empty. `test_backend.py` — `report_hits` posts the body and returns False on error.
- [ ] **Step 2:** Run `$V/python -m pytest blocker/tests -q` → FAIL. **Step 3:** Implement. **Step 4:** PASS (139+ passed, lab tests deselected).
- [ ] **Step 5:** Commit `feat(blocker): count lock-page hits per device and report them`.

### Task 8: Frontend types, hooks and pure helpers

**Files:**
- Modify: `frontend/src/v2/types.ts`, `frontend/src/v2/hooks/useDevices.ts` (`useSaveGroup` body adds `icon?`, `chore_lock?`), `frontend/src/v2/today/GetStartingChecklistCard.tsx`
- Create: `frontend/src/v2/hooks/useHours.ts`, `frontend/src/v2/hooks/useDeviceActivity.ts`, `frontend/src/v2/manage/hoursMeta.ts`, `frontend/src/v2/manage/activityText.ts`
- Test: `frontend/tests/v2/hoursMeta.test.ts`, `frontend/tests/v2/activityText.test.ts` (new), `frontend/tests/v2/GetStartingChecklistCard.test.tsx`

**Interfaces — Produces:**
- Types: `RuleCategory = 'school_night'|'weekend'|'holiday'|'summer'|'other'`; `RuleKind = 'allowed'|'free'|'off'`; `HourRule {id, name, category, kind, days, start_date: string|null, end_date: string|null, everyone, kid_ids: number[], group_ids: number[], times: {start: string; end: string}[]}`; `RuleBody = Omit<HourRule, 'id'>`; `HoursPayload {today: RuleCategory|null, rules: HourRule[]}`; `Device` adds `exempt: boolean, reason, chores_done, chores_total, locks_at, alerts, address_changes?, blocked_since?`; `Group` makes `icon: string` required and adds `chore_lock: boolean`; `Family` adds `chores_lock: boolean`; `DeviceEvent` = backend `EventOut`; `DeviceActivity {counts: {bypass, locked_tries, outside_hours, wrong_pins}, events: DeviceEvent[], history: DeviceEvent[], days: {date, slots, online_minutes}[]}`.
- `useHours()` (key `['hours']`), `useSaveRule()` (POST, or PUT when `id` given), `useDeleteRule()`; invalidate `['hours']`, `['devices']`, `['today']`.
- `useDeviceActivity(id)` (key `['device-activity', id]`, poll 30 s), `useMarkOk()`, `useMergeDevice()`, `useLockKid()`; invalidate `['device-activity']`, `['devices']`.
- `hoursMeta.ts`: `CATEGORIES: {key: RuleCategory; label: string; plural: string; texture: string}[]` in precedence display order (school_night "School night"/"School nights" `pt-school`, weekend "Weekend"/"Weekends" `pt-week`, holiday "Holiday"/"Holidays" `pt-holi`, summer "Summer"/"Summer" `pt-summer`, other "Other"/"Other hours" `pt-other` = plain accent fill, no texture); `KINDS: {key: RuleKind; label: string; times: string}[]` = allowed "Online" / "Times online", free "Free time" / "Free time", off "Internet off" / "Times off"; `daysLabel(days)` and `segments(start, end)` (moved from `HoursTimeline.tsx`, same behaviour); `rangeLabel(start, end): string`; `ruleTexture(rule): string` (`pt-kid` if any kid, else `pt-group` if any group, else the category texture); `whoLabel(rule, kids, groups): string` ("Everyone", else names joined ", ", "No one yet" when empty); `sortRules(rules): HourRule[]` (Decision 11); `presetDays(category): string | null` (school_night `01236`, weekend `45`, holiday/summer `0123456`, other null).
- `activityText.ts`: `eventText(e: DeviceEvent, deviceName: string): {icon, sev: 'hi'|'md'|'lo', title, sub}`; `historyText(e): {icon, title}`; `whyText(d: Device): string`; `whenLabel(iso, tz, nowMs): string`; `slotRuns(slots: string): {state: 'o'|'l'; from: number; to: number}[]` (percent of day). Exact copy:
  - bypass `gpp_maybe` hi: "Got around the lock for {m} min" (`last_at` null → "Getting around the lock now"); sub "Kept reaching the internet while locked: the lock was being dodged (often a manual network setting or VPN). The box re-locked it."
  - new_address `swap_horiz` md: "New address right after locking"; sub "A “new device” named {other_device_name} joined {minutes} min after this device locked. Likely a private MAC switch to dodge the lock."
  - outside_hours `schedule` md: "Tried to get online outside allowed hours"; sub "{count} tries between {at time} and {last_at time}. Each try hit the lock page." (count 1 → "1 try at {at time}. It hit the lock page.")
  - left_wifi `wifi_off` md: "Left Wi-Fi while locked"; sub "Dropped off the home network {minutes} min after locking. May have used mobile data or a hotspot; the box can't see that traffic."
  - sign_in `pin` md: "{count} wrong PIN tries on {kid_name}'s sign-in, from this device" (1 → "1 wrong PIN try …"); sub "Someone on {deviceName} tried to sign in as {kid_name}."
  - locked_try `block` lo: "Tried to get online while locked ({why})", why: chores "chores not done", manual "locked by a parent", new_device "new device"; sub "{count} tries".
  - history: locked + schedule `lock` "Locked by schedule"; chores `lock` "Locked: chores not done"; manual `lock` "Locked by {by_name}"; new_device `lock` "Locked: new device"; unlocked + manual `lock_open` "Unlocked {minutes} min by {by_name}" (no minutes → "Unlocked by {by_name}"); chores `task_alt` "Opened: chores done"; schedule `lock_open` "Opened by schedule"; free_time `lock_open` "Opened: free time"; bonus `lock_open` "Opened: screen time"; exempt `verified_user` "Opened: always allowed"; guest `lock_open` "Opened: marked as guest"; unassigned `lock_open` "Opened: new devices allowed".
  - `whyText`: chores "Chores {done}/{total} done" when blocked, "Chores done" when open; schedule "Outside allowed hours" when blocked, "No chores to wait for" when open; manual "Locked by a parent" / "Unlocked by a parent"; new_device "New device, waiting for you"; free_time "Free time"; bonus "Screen time"; guest "Guest, never blocked"; exempt "Always allowed"; unassigned "New device, allowed until you assign it".
  - `whenLabel`: same family-local day → "Today 3:04 PM"; previous day → "Yesterday 8:00 PM"; within 6 days → "Tue 9:14 PM"; else "Oct 12, 4:03 PM".
- `GetStartingChecklistCard`: hours ticked when `useHours().data?.rules.length > 0`.

- [ ] **Step 1:** Tests `hoursMeta.test.ts`: `rangeLabel` cases `06:00–08:00 → "6–8a"`, `15:00–20:00 → "3–8p"`, `08:00–22:00 → "8a–10p"`, `16:00–19:30 → "4–7:30p"`, `09:00–21:00 → "9a–9p"`, `00:00–06:00 → "12–6a"`; `sortRules` puts everyone school_night, weekend, holiday, summer, then group, then kid rules; `ruleTexture` kid → `pt-kid`; `presetDays('school_night') === '01236'`; `whoLabel` with 0 targets → "No one yet". `activityText.test.ts`: one assertion per eventText kind above (titles exact), history manual unlock 30 → "Unlocked 30 min by Dad", `whyText` blocked chores 3/5 → "Chores 3/5 done", exempt → "Always allowed", `slotRuns('oo..ll' + '.'.repeat(138))` → two runs `o` 0–1.389 %, `l` 2.778–4.167 % (toBeCloseTo), `whenLabel` yesterday case.
- [ ] **Step 2:** `npx jest hoursMeta activityText` → FAIL. **Step 3:** Implement. **Step 4:** PASS; `npx tsc --noEmit` clean. (`useWindows.ts` and the `TimeWindow` type stay until Task 9.)
- [ ] **Step 5:** Commit `feat(hours): frontend types, hooks and hours/activity text helpers`.

### Task 9: Settings → Hours pane and rule editor

**Files:**
- Rewrite: `frontend/src/v2/manage/HoursSection.tsx`, `frontend/src/v2/manage/HoursTimeline.tsx`
- Create: `frontend/src/v2/manage/RuleEditor.tsx`
- Delete: `frontend/src/v2/manage/WindowEditor.tsx`, `frontend/src/v2/hooks/useWindows.ts`, the `TimeWindow` type
- Modify (minimal, so nothing imports `useWindows`): `frontend/src/v2/manage/DevicesPage.tsx` and `GroupDetail.tsx` — `DevicesPage` passes `rules={useHours().data?.rules ?? []}` instead of `windows`; `GroupDetail` renders `<HoursTimeline rules={rules.filter((r) => r.everyone || r.group_ids.includes(group.id))} … />` (Task 11 restyles that card)
- Modify: `frontend/src/v2/manage/SettingsPage.tsx` (drop the old InfoBlock under Hours if it contradicts the new header), `frontend/src/v2/parent/parent-manage.css`
- Test: `frontend/tests/v2/hoursTimeline.test.tsx`, `frontend/tests/v2/ruleEditor.test.tsx` (new), `frontend/tests/v2/settings.test.tsx`

**Interfaces — Produces:**
- `HoursTimeline({rules, kids, groups, onEdit?}: {rules: HourRule[]; kids: Kid[]; groups: Group[]; onEdit?: (r: HourRule) => void})` — one row per rule (`sortRules`): swatch `.sq.pt.{ruleTexture}`, kid initial avatar when exactly one kid target, name + small `{whoLabel} · {daysLabel or "Dec 20 – Jan 3"}`, bars from `segments()` per time with `rangeLabel` inside, `data-kind` on the bar (`free` → dashed ink outline, `off` → `--p-red-bg` fill + 1.5px `--p-red` border, label in `--p-red`), pencil button `aria-label="Edit {name}"` when `onEdit`. Axis 12a 6a 12p 6p 12a. Empty: "No hours yet. Devices can be online any time until you add some."
- `RuleEditor({opened, rule, initial, categories, showWho, onClose, onSave?})`: Mantine `Drawer` right (full width under 768px), title "Edit hours" / "Add hours". Fields in order: **Name** (`label` icon, required), **Kind** (segmented over `categories`, default all five; changing it applies `presetDays` when not null), **What it does** (segmented Online / Free time / Internet off), **Who** (only when `showWho`; otherwise `everyone: true`): an Everyone switch; when it is off, kid pills + group pills (multi-select, `KidPills` style), **Days** (S M T W T F S toggle buttons, Sun-first), **Dates** (first day / last day `<input type="date">`; required and always shown for holiday/summer, behind a "Only between dates" switch otherwise), **{KINDS.times}** rows (`schedule` start "to" end, × remove, min 1), **Add another time** (max 6), hint "Ends the next morning" for an overnight row, buttons **Cancel**, **Delete** (edit only, `ConfirmDelete` "Delete {name}? Its kids and groups go back to their other hours."), **Save** (`check`). Without `onSave` it calls `useSaveRule`; with `onSave(body)` (setup draft mode) it returns the body instead. Server `detail` shows via `toastFail`.
- `HoursSection()` (mockup 02 Settings → Hours): header h2 "Hours", sub "When devices may be online. Outside these, they lock.", buttons **Add holiday** (`event`; opens editor with category holiday) and **Add window** (`add`, accent; category other); card **Family schedule** (`calendar_month`) with right-aligned "Today: **{CATEGORIES label of today}**" (hidden when null) and `HoursTimeline`; card **Patterns** (`texture`): legend (six textures with "· stripes / solid / dots / lines / crosshatch / horizontal lines" copy as mockup, plus "Free time · dashed" and "Internet off" only when such rules exist) and the precedence line ("Holiday and Summer › Per child › Per group › Everyone"); card **Rules** (`tune`): switch "Lock until today's chores are done" bound to `family.chores_lock` (PATCH /family).

- [ ] **Step 1:** Tests: `hoursTimeline.test.tsx` (rewrite) — renders a row per rule in `sortRules` order, a kid rule shows its initial, an `off` bar has `data-kind="off"`, clicking the pencil calls `onEdit`. `ruleEditor.test.tsx` — picking Kind "School nights" sets days to S M T W T on; Holiday without dates disables Save and shows "Holidays and summer need a first and last day."; Save posts `{name, category, kind, days, times, everyone, kid_ids, group_ids, start_date, end_date}` with two ticked kids and one group; edit mode Save sends PUT to `/hours/{id}`. `settings.test.tsx` — Hours pane shows "Today: School night" and the precedence line "Holiday and Summer › Per child › Per group › Everyone" from the mocked payload and toggling the chores switch PATCHes `{chores_lock: false}`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (mock `/hours` in tests the way `settings.test.tsx` mocks other endpoints). **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Demo check: copy changed frontend files into `/home/user/code/tskfrce-demo/frontend` (same paths), log in `admin` / `demo-parent-1` at http://127.0.0.1:3766, open Settings → Hours at 1440 and 390 wide, light and dark; screenshot next to mockup 02 Settings → Hours; fix drift.
- [ ] **Step 6:** Commit `feat(hours): settings hours pane with named rules, patterns and editor`.

### Task 10: Setup step 6 — hours

**Files:**
- Create: `frontend/src/v2/setup/StepHours.tsx` (replaces `StepWindows.tsx`; delete it)
- Modify: `frontend/pages/setup.tsx`, `frontend/src/v2/setup/wizard.module.css`
- Test: `frontend/tests/v2/setup.test.tsx`

**Interfaces — Consumes:** `RuleEditor` (with `categories={['school_night','weekend']}`, `showWho={false}`, `onSave`), `HoursTimeline`, `rangeLabel`.
**Interfaces — Produces:** `StepHours({drafts, onChange, choresLock, onChoresLock})` where `drafts: RuleBody[]`.

Behaviour (mockup 07 step 6): sub "When can devices be online? A starting schedule. Add holidays, summer and per-kid hours later in Settings." Card **Allowed hours** (`calendar_month`) with **Add hours** (`add`) and one row per draft (name, range labels, pencil `edit`) over the 12a–12a axis. Defaults: "School nights" school_night allowed `01236` 06:00–08:00 + 15:00–20:00; "Weekends" weekend allowed `45` 08:00–22:00; both `everyone: true`. Below: "Bedtime on school nights" and "Bedtime on weekends" time inputs bound to the end of the last time of the first draft with that category (hidden when no such draft), and switch "Lock until today's chores are done" (default on). **Next** POSTs each draft to `/hours` (skip a draft whose name already exists in GET `/hours`, so re-running the step creates no duplicates; use the existing `run([{key, run}])` helper with key `rule:{name}`) and PATCHes `/family {chores_lock}`.

- [ ] **Step 1:** Tests: default drafts render "School nights 6–8a 3–8p" and "Weekends 8a–10p"; changing "Bedtime on weekends" to 23:00 updates the row to "8a–11p"; Next posts two rules with `everyone: true` and PATCHes `chores_lock`; with "School nights" already on the server only "Weekends" is posted.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Commit `feat(setup): hours step with school nights, weekends and bedtime`.

### Task 11: Groups — icon, chore switch, hours, summary strip

**Files:**
- Modify: `frontend/src/v2/manage/GroupDetail.tsx` (split out `GroupStats.tsx` if it passes 250 lines), `frontend/src/v2/manage/DeviceList.tsx` (group tile uses `group.icon`), `frontend/src/v2/parent/parent-devices.css`
- Test: `frontend/tests/v2/devices.test.tsx`, `frontend/tests/v2/devicesEdge.test.tsx`, `frontend/tests/v2/manage.test.tsx` (remove `/windows` mocks)

Behaviour (mockup 02 Groups):
- Header tile and list tile use `group.icon`.
- **Group** card (`edit`): Group name, **Icon** = `GlyphPicker` with `GROUP_ICONS = ['tablet_mac','sports_esports','tv','laptop','smartphone','speaker','router','devices_other','devices']`, switch "Lock with the kids' chores" (`chore_lock`) with hint "Off: these devices skip the chore check. Hours and manual locks still apply." Saves via `useSaveGroup({id, name, device_ids, icon, chore_lock})`.
- **Hours for this group** card (`calendar_month`) with right link "Edit in Settings → Hours" (`/settings?section=hours`): `HoursTimeline` (no `onEdit`) of rules where `everyone || group_ids.includes(group.id)`; a group rule's small line reads "only this group".
- Summary strip under the cards: **Online now** "{n open} of {members}", **Alerts · 7 days** Σ `device.alerts`, **Overrides today** count of members with a live `override`, **Next lock** earliest `locks_at` in family time ("—" when none).

- [ ] **Step 1:** Tests: picking `tv` and saving sends `icon: 'tv'`; switching off the chore switch sends `chore_lock: false`; the hours card lists an everyone rule and this group's rule but not another group's; strip shows "2 of 3" and Next lock "7:30 PM" from mocked devices.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint. `grep -rn "useWindows\|TimeWindow\|/windows" frontend/src frontend/pages frontend/tests` → no hits; delete leftovers.
- [ ] **Step 5:** Demo check at 1440/390 light/dark vs mockup 02 Groups; fix drift.
- [ ] **Step 6:** Commit `feat(groups): group icon, chore switch, hours and summary strip`.

### Task 12: Device Overview and Network additions

**Files:**
- Modify: `frontend/src/v2/manage/DeviceDetail.tsx`, `frontend/src/v2/manage/DeviceNetwork.tsx`, `frontend/src/v2/manage/DeviceList.tsx` (Exempt chip + glyph state)
- Create: `frontend/src/v2/manage/DeviceRightNow.tsx`, `frontend/src/v2/manage/OnlineWeek.tsx`
- Test: `frontend/tests/v2/deviceOverview.test.tsx` (new), `frontend/tests/v2/devices.test.tsx`

Behaviour (mockup 02 Devices → Overview / Network):
- `DeviceRightNow({device, timeZone})` replaces the inline Right now panel: **State** Open / Locked / Guest (Locked = `!device.online`), **Why** `whyText(device)`, **Locks at** `locks_at` in family time (row hidden when null), **Override** "None · on schedule" or "Locked until 8:30 PM" / "Unlocked until …" / "Locked" (no expiry).
- `OnlineWeek({days, timeZone})` card **Online this week** (`timeline`): one row per day (label "Today", then short weekday), bars from `slotRuns` (online = accent fill with ink label in dark mode, ink fill in light mode per §2.4; locked = `--p-red-bg` with `--p-red` border), 12a–12a axis, legend Online / Locked / Offline. Data from `useDeviceActivity(device.id)`; while loading show the existing skeleton row; hidden for guest devices.
- Network tab adds rows **Address changes (7 days)** `address_changes`, **Blocker hold** "Healthy" (blocker online and not resisting) / "Slipping" (resisting) / "Box offline" (`useBlocker().data.online === false`), **Resisting blocker** Yes/No — only the ones `DeviceNetwork` doesn't already show.
- Overview gets a switch **Always allowed (never lock)** (`exempt`, hint "Skips hours and the chore check. A manual lock still applies.") saving via the device PATCH. When on, Right now shows State Open, Why "Always allowed", Locks at hidden.
- `DeviceList`: an **Exempt** `Chip` on the row when `exempt`. Glyph state order: ... manual-lock check, then exempt (tone grey, icon `verified_user`, tip "Exempt · always allowed"), then the remaining states.
- Segmented tabs gain **Activity** with a red count `Chip` when `device.alerts > 0` (panel itself in Task 13; render a placeholder `null` until then).

- [ ] **Step 1:** Tests: Right now shows "Chores 3/5 done" and "Locks at 8:00 PM" for a mocked blocked device; Online this week renders 7 rows with "Today" first; Network shows "Address changes (7 days)" 1 and "Blocker hold" Healthy; Activity tab label carries count 1; toggling "Always allowed (never lock)" PATCHes `{exempt: true}`; in `devices.test.tsx` an exempt device row shows the "Exempt" chip and glyph `verified_user` with tip "Exempt · always allowed", but a manually locked exempt device shows the lock glyph, not the exempt one.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Commit `feat(devices): right-now reasons, online this week, network history rows`.

### Task 13: Device Activity tab

**Files:**
- Create: `frontend/src/v2/manage/DeviceActivity.tsx`, `frontend/src/v2/manage/LockHistory.tsx`
- Modify: `frontend/src/v2/manage/DeviceDetail.tsx` (mount the tab), `frontend/src/v2/parent/parent-devices.css`
- Test: `frontend/tests/v2/deviceActivity.test.tsx` (new)

Behaviour (mockups 02 Activity, 04 Device → Activity, 05 clean activity):
- KPI strip: **Bypass attempts · 7d** (red tile when > 0), **Tries while locked · 7d**, **Outside allowed hours · 7d**, **Wrong PINs · 7d**.
- **Attempts & alerts** card (`policy`) with filter pills **All · Bypass · While locked · Sign-in** (FILTERS from Task 1). Each row: severity tile with `eventText` icon, title, sub, time `whenLabel(at)` on the right, and actions:
  - `new_address`: **Same device, merge** (`merge`) → `useMergeDevice`, toast "Merged"; **Different device** → `useMarkOk`.
  - every other kind: **Ask {kid}** (`chat`) → `openChat('private', String(kidId))`, **Lock all {kid}'s devices** (`lock`) → `useLockKid({kid_id, action: 'lock'})`, toast "Locked all {kid}'s devices"; kid = `e.kid_id` for sign_in else the device's first owner; both hidden when there is no kid. **Mark OK** → `useMarkOk` (hidden once `reviewed`; reviewed rows render at 60% opacity).
- Empty feed (§3.10): `verified_user` "No attempts this week" / "{device name} hasn't tried to get around the lock or go online outside hours."
- **Time online per day** card (`bar_chart`): 7 bars oldest → today, labels short weekday with "Today" last, height ∝ `online_minutes` (max = tallest day, min 2px), `title` "2 h 10 min". Light: ink bars on `#e4e4e1` track; dark: accent on `#3d3d3b`.
- `LockHistory` card (`history`): `historyText` rows with icon + title + `whenLabel(at)`; empty "No locks yet."

- [ ] **Step 1:** Tests: filter "Sign-in" shows only the sign_in row; Merge calls `/devices/{id}/events/{eid}/merge`; Mark OK hides its button; Lock all posts `/kids/{kid}/override` `{action: 'lock'}`; empty feed shows "No attempts this week"; history row "Unlocked 30 min by Dad".
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Demo check of Overview / Network / Activity at 1440 and 390, light/dark, vs mockups 02 and 04 (seed a few events in the demo DB with `/api/v1/internal/devices/hits` and a manual lock/unlock); fix drift.
- [ ] **Step 6:** Commit `feat(devices): activity tab with alerts, actions, time online and lock history`.

### Task 14: End-to-end and demo pass

**Files:**
- Create: `frontend/e2e/devices-hours.spec.ts` (follow `chore-model.spec.ts` login helpers and seeding)
- Test: `scripts/lab.sh e2e`, `RUN_INTEGRATION=1` lab journeys

- [ ] **Step 1:** Spec: parent opens Settings → Hours, **Add window** "Homework time", Kind Other, Internet off, Mon–Fri, a time range covering now, ticks kid1 and a group → the timeline shows "Homework time" with `data-kind="off"`; kid1's device shows Locked with Why "Outside allowed hours"; parent edits the rule to a range that excludes now → device Open again (one edit, every target); parent locks a device 30 min, unlocks it → Activity → Lock history shows "Locked by …" and "Unlocked by …"; group detail lists "Homework time" under Hours for this group.
- [ ] **Step 2:** `bash scripts/lab.sh up && bash scripts/lab.sh e2e` → all pass (was 41 passed / 5 skipped + the new spec). `cd blocker && RUN_INTEGRATION=1 $V/python -m pytest tests/lab -q` → pass (economy journey uses `/hours`).
- [ ] **Step 3:** Demo: confirm the demo DB is on head, copy all changed frontend files to `/home/user/code/tskfrce-demo/frontend`, click through Settings → Hours, setup step 6 (a fresh `/setup` preview if available, else the component in jest only), Groups, Device Overview/Network/Activity in light/dark/phone; run axe on those screens → 0 serious/critical.
- [ ] **Step 4:** Commit `test(e2e): hour rules and device activity flow`.
