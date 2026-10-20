# t@sk4ce v2.0 — Plan 1: Baseline, Slim-down, Lock Core (backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the old app into a slim v2 backend that knows kids, devices, chores, windows, and can compute which devices must be offline, ready for the blocker (Plan 2) and new UI (Plan 3).

**Architecture:** Keep FastAPI/SQLAlchemy/SQLite. Remove Redis, MinIO, Celery. New `backend/app/lock/` package holds pure logic (schedule math, rule engine) plus a 30-second asyncio loop that runs the daily reset and pushes the blocked-MAC list to the blocker over HTTP. Chores reuse `Task`: a recurring Task is a *definition*; the daily reset creates one *instance* Task per day (`parent_task_id` → definition, `due_date` = chore day).

**Tech Stack:** Python 3.11, FastAPI 0.104, SQLAlchemy 2.0, Alembic, pydantic 2, pytest, ruff, httpx, zoneinfo (stdlib).

**Spec:** `docs/superpowers/specs/2026-10-20-task4ce-v2-design.md` (read §4, §5, §6, §8, §12 before starting)

**Later plans (not here):** Plan 2 blocker service · Plan 3 frontend + wizard · Plan 4 packaging (single app image, Pi image, CI release, docs).

## Global Constraints
- Display name **t@sk4ce**; technical slug **`task4ce`** (DB file `task4ce.db`, logger names, image names).
- Roles: **parent**, **kid** only.
- No default credentials anywhere; secrets generated at first boot, stored in the data volume.
- All persistent data under one dir: setting `DATA_DIR` (default `./data`): `task4ce.db`, `uploads/`, `secrets.json`.
- Files < 500 lines. Touching a file >500 lines → split the part you touch out.
- Conventional commits; semantic versioning. CI (ruff + pytest) green before every commit.
- Default reset time `06:00`; new devices blocked by default; "points can unlock early" off by default; new kid has no windows.
- Copy in API error messages: plain words, say what happened and how to fix it.
- Run all backend commands from `backend/` with the venv active: `source .venv/bin/activate`.

## Review Focus
1. **Window crossing midnight** (allowed 20:00–02:00): device must be online at 01:00 Tuesday if Monday is in `days`. Test in Task 9.
2. **Before reset time on a new day** (03:00): yesterday's chores still count; nothing relocks until reset. Test in Task 11.
3. **Shared device, one owner has zero chores today, other has pending chores** → offline. Test in Task 10.
4. **DST change day** (reset at 06:00 local, family tz `America/New_York`, 2026-11-01): reset runs exactly once. Test in Task 11.
5. **Kid calls kid API from a device not owned by them / unknown IP** → 403 with plain message, never another kid's chores. Test in Task 14.

---

### Task 1: Baseline git history

**Files:** none (git only).

- [ ] **Step 1:** `git checkout main && git merge --no-ff origin/frontend_refactor -m "chore: merge frontend_refactor as v1 baseline"` (resolve README/.gitignore conflicts by keeping the branch's version and re-adding `.superpowers/` to `.gitignore`).
- [ ] **Step 2:** `git tag -a v1.0.0 -m "v1: the old app"`.
- [ ] **Step 3:** `git checkout -b feat/v2-core`. All following tasks commit here.
- [ ] **Step 4:** Do **not** delete branches or push tags without the owner's OK.

### Task 2: Test harness, ruff, CI

**Files:**
- Create: `backend/tests/conftest.py`
- Modify: `backend/tests/test_health.py`, root `pyproject.toml` (tool config), `.github/workflows/ci-cd.yml` (lint + test jobs), `backend/requirements.txt`
- Delete: root `tests/` (live-Docker tests for Redis/MinIO; superseded), `[project.scripts]` entry pointing at `run_tests.py`

**Interfaces — Produces:** fixtures `db` (SQLAlchemy `Session`, in-memory SQLite, fresh per test) and `client` (`TestClient` with `get_db_session` and `get_db` overridden to yield `db`); helper fixtures `parent` and `kid` (User rows) and `parent_headers` (dict with `Authorization: Bearer <token>`), added in Task 7.

- [ ] **Step 1:** `cd backend && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt ruff httpx`.
- [ ] **Step 2:** Write `conftest.py`: engine `sqlite://` with `StaticPool`, `Base.metadata.create_all(engine)` using `app.core.database.Base` after `_import_all_models()`; `client` overrides dependencies via `fastapi_app.dependency_overrides` (note: `app.main.app` is a `MetricsMiddleware` wrapper; `TestClient(app)` still works, overrides go on `fastapi_app`).
- [ ] **Step 3:** Run `python -m pytest tests -q`. Expected: `test_health` PASS.
- [ ] **Step 4:** pyproject: replace black/isort/flake8 config with `[tool.ruff] line-length = 100, target-version = "py311"`, `[tool.ruff.lint] select = ["E","F","I","B","UP"]`; set pytest `testpaths = ["backend/tests"]`; `requires-python = ">=3.11"`. Add `ruff` to `requirements.txt` dev section (or a `requirements-dev.txt`).
- [ ] **Step 5:** `ruff format app tests && ruff check --fix app tests`. Fix remaining errors by hand only where trivial; add `# noqa: <code>` with reason otherwise.
- [ ] **Step 6:** CI lint job: `pip install -r backend/requirements.txt ruff` then `cd backend && ruff format --check . && ruff check .`; keep frontend `npm run lint`/`type-check`. Test job: `cd backend && python -m pytest tests -q` (no docker compose). Remove `docker compose logs/down` steps.
- [ ] **Step 7:** Run lint + tests locally; both pass. Commit `chore: switch to ruff and in-process pytest harness`.

### Task 3: One database module + real Alembic baseline

**Files:**
- Delete: `backend/app/db/session.py`, `backend/app/db/config.py` (keep `app/db/__init__.py` only if something imports it; else delete dir)
- Modify: `backend/app/core/database.py`, every `from app.db.session import get_db_session` → `from app.core.database import get_db_session`, `backend/alembic/env.py`, `backend/alembic.ini`, `backend/entrypoint.sh`
- Delete: `backend/alembic/versions/98d3f5781bf6_initial_migration.py`
- Create: new autogenerated baseline in `backend/alembic/versions/`
- Test: `backend/tests/test_migrations.py`

**Interfaces — Produces:** `app.core.database.get_db_session() -> Iterator[Session]` (same contract as before); `Base` single source.

- [ ] **Step 1:** Test `test_alembic_upgrade_creates_tables`: run `alembic upgrade head` against a temp-file SQLite URL (`-x url=...` or env `DATABASE_URL`), then assert `"users"` and `"tasks"` in `inspect(engine).get_table_names()`.
- [ ] **Step 2:** Run → FAIL (empty migration).
- [ ] **Step 3:** Add `get_db_session` to `core/database.py`; make `env.py` import `Base` from `app.core.database`, call `_import_all_models()`, and read URL from `settings.DATABASE_URL`. Export the unexported models (`TaskList`, `TaskListAssociation`, `TaskTagAssociation`, `LeaderboardEntry`, `Streak`) from `models/__init__.py`. Use `render_as_batch=True` (SQLite).
- [ ] **Step 4:** `alembic revision --autogenerate -m "v2 baseline"`; review file; remove `create_all` call from startup `init_database()` and instead have `entrypoint.sh` run `alembic upgrade head` before uvicorn.
- [ ] **Step 5:** Tests pass. Commit `refactor(db): single Base and real alembic baseline`.

> Every later task that adds/changes models ends with `alembic revision --autogenerate -m "<what>"` and keeps `test_alembic_upgrade_creates_tables` green.

### Task 4: Remove Redis and Celery

**Files:**
- Delete: `backend/app/services/redis_service.py`, `backend/app/api/redis.py`, `backend/scripts/clear_redis_cache.py`, `backend/app/core/rate_limiting.py` (middleware already disabled)
- Modify: `backend/app/main.py` (router + `initialize_redis` + rate-limit lines), `backend/app/services/task_service.py:38` and its cache-invalidation calls (delete calls), `backend/app/core/monitoring.py:120` (drop Redis health), `backend/app/core/config.py` (drop `REDIS_*`), `backend/requirements.txt` + `pyproject.toml` (drop `redis`, `celery`, `boto3`), `docker-compose.yml` (drop `redis` service, volume, `depends_on`), `backend/entrypoint.sh` (drop `nc` waits; `--reload` only when `ENVIRONMENT=development`)

- [ ] **Step 1:** `grep -rn "redis" backend/app` → list. Remove each use.
- [ ] **Step 2:** `grep -rni "redis\|celery\|boto3" backend/ docker-compose.yml` returns nothing except lock files (regenerate `backend/uv.lock` with `uv lock` if used).
- [ ] **Step 3:** Tests + ruff pass; `python -c "import app.main"` OK. Commit `refactor: remove redis and celery`.

### Task 5: MinIO → local disk storage

**Files:**
- Create: `backend/app/services/local_storage.py`
- Delete: `backend/app/services/storage_service.py`
- Modify: `backend/app/services/media_service.py:17,29`, `backend/app/api/media.py` (drop `get_minio_statistics` route ~183; presigned upload route ~236 → regular multipart upload; download URL route returns `/api/v1/media/files/<key>`), `main.py` (drop `initialize_minio`), `core/config.py` (drop `MINIO_*`), `docker-compose.yml` (drop `minio`), requirements (drop `minio`)
- Test: `backend/tests/test_local_storage.py`

**Interfaces — Produces:** class `LocalStorage(root: Path)` with `save(key: str, data: bytes, content_type: str) -> str`, `open(key: str) -> Path`, `delete(key: str) -> None`, `stats() -> dict` (`{"files": int, "bytes": int}`). Root = `settings.DATA_DIR / "uploads"`. Route `GET /api/v1/media/files/{key:path}` → `FileResponse`.

- [ ] **Step 1:** Tests: `test_save_then_open_returns_same_bytes`, `test_key_with_dotdot_rejected` (`save("../x", ...)` raises `ValueError`), `test_delete_removes_file`, `test_stats_counts_files`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; reject keys whose resolved path is outside root. Match the method names `MediaService` already calls (rename calls where they differ). **Step 4:** Pass. **Step 5:** Commit `refactor(media): store uploads on local disk`.

### Task 6: First-boot secrets, no default credentials

**Files:**
- Create: `backend/app/core/secrets.py`
- Modify: `backend/app/core/config.py` (add `DATA_DIR: Path = Path("./data")`; `DATABASE_URL` default `sqlite:///{DATA_DIR}/task4ce.db`; `SECRET_KEY`/`JWT_SECRET_KEY` default `None`), `README.md` (delete default admin credentials), any seed script creating a default admin (`grep -rn "admin" backend/scripts backend/app/core`) → delete; `docker-compose.yml` (remove secret defaults, mount `./data:/app/data`)
- Test: `backend/tests/test_secrets.py`

**Interfaces — Produces:** `load_or_create_secrets(data_dir: Path) -> dict[str, str]` returning `{"SECRET_KEY", "JWT_SECRET_KEY", "INTERNAL_TOKEN"}`; env vars override file values; called once at settings load. `INTERNAL_TOKEN` authenticates blocker→app calls (Task 12).

- [ ] **Step 1:** Tests: `test_creates_file_with_three_32plus_char_secrets` (file mode `0o600`), `test_second_call_returns_same_values`, `test_env_overrides_file`.
- [ ] **Step 2–4:** FAIL → implement with `secrets.token_urlsafe(32)` → PASS.
- [ ] **Step 5:** `grep -rn "your-secret-key-here\|minioadmin\|admin123" .` returns nothing outside `.git`. Commit `fix(security): generate secrets at first boot, drop default credentials`.

### Task 7: Parent/kid roles, setup endpoint

**Files:**
- Modify: `backend/app/models/user.py:16-21`, `backend/app/api/deps.py`, `backend/app/services/permission_service.py` (map old roles), `backend/tests/conftest.py` (fixtures)
- Create: `backend/app/api/setup.py` (router prefix `/api/v1/setup`), `backend/app/models/family.py`
- Add column on `User`: `pin_hash: str | None`, `avatar: str | None`
- Test: `backend/tests/test_setup.py`

**Interfaces — Produces:**
- `UserRole`: `PARENT = "parent"`, `KID = "kid"`, plus aliases `ADMIN = "parent"`, `ORGANIZER = "parent"`, `USER = "kid"` with comment `# ponytail: aliases keep v1 code compiling; remove as code is touched`.
- `FamilySettings` (table `family_settings`, single row `id=1`): `name: str`, `timezone: str = "UTC"`, `reset_time: str = "06:00"`, `new_devices_blocked: bool = True`, `points_unlock_early: bool = False`, `last_reset_date: date | None`, `owner_id: int | None`. Helper `get_family(db) -> FamilySettings` (creates row if missing).
- `deps.require_parent(user = Depends(get_current_active_user)) -> User` → 403 `"Only parents can do this."` if not parent.
- `GET /api/v1/setup` → `{"needed": bool}` (true when no users exist). `POST /api/v1/setup` body `{family_name, timezone, parent: {username, password, full_name}}` → 201 `{access_token}`; 409 `"Setup is already done. Log in instead."` if any user exists. Sets `owner_id`.
- conftest fixtures `parent`, `kid`, `parent_headers`.

- [ ] **Step 1:** Tests: `test_setup_needed_on_empty_db`, `test_setup_creates_owner_parent_and_family`, `test_setup_twice_returns_409`, `test_kid_cannot_call_parent_endpoint` (kid token on `PATCH /api/v1/family` → 403; endpoint arrives in Task 13, so use any `require_parent` route available, or add the test in Task 13).
- [ ] **Step 2–4:** FAIL → implement (hash password via the same helper `/api/v1/auth` registration uses) → PASS. Migration revision.
- [ ] **Step 5:** Commit `feat(auth): parent and kid roles with first-run setup`.

### Task 7A: Auth hardening (v1 security debt)

Automated security review of the v1 code found spoofable identity everywhere. A kid must never be able to act as a parent.

**Files:** Modify `backend/app/api/deps.py` (remove `get_current_user_from_header` / `X-User-Data` fallback), `backend/app/api/{messaging,comments,workflow,notifications,mentions,presence}.py` (drop `get_user_data_from_header`, use `Depends(get_current_active_user)`), `backend/app/api/websocket.py` (require `?token=<JWT>`, verify before `accept()`, close 4401 otherwise), `backend/app/api/{goals,media}.py` (remove `current_user_id: int = 1`; `GET /media/files/{key}` looks up the attachment by `file_path == key` and returns 404 unless owner, `is_public`, parent, or the caller can see the attachment's task — test `test_other_kid_cannot_fetch_file`), `backend/app/api/gamification.py` (mutating routes `require_parent`; per-user reads: self or parent), `backend/app/api/users.py` (`update_user`: self or parent; only parents change `role`/`is_active`/`is_superuser`), `backend/app/services/permission_service.py` (unknown resource → `False`; remove unconditional `TASK_VIEW` grant → visible if creator, assignee, or parent), `frontend/src/components/pages/auth/LoginPage.tsx` (empty initial form), `frontend/pages/api/proxy/[...path].ts` (no header logging; must forward `Authorization`), frontend websocket client (send `?token=`). Delete the duplicate `get_current_user` set in `core/auth.py:200-260` if unused after this. `backend/app/services/mention_service.py`: `get_mentionable_users` is broken (uses nonexistent `User.first_name/last_name`) and searches/returns `email` — rewrite to search `username`/`full_name` only, never return `email`, escape LIKE wildcards (`ilike(..., escape='\\')`); test `test_mention_search_never_returns_email`. Test: `backend/tests/test_auth_hardening.py`.

Rate limiting (replaces deleted Redis limiter): add `backend/app/core/ratelimit.py` — in-memory `limit(key: str, max_hits: int, per_seconds: int) -> None` raising 429 `"Too many tries. Wait a minute and try again."` (ponytail: single-process dict, fine for one Pi). Apply to `/api/v1/auth/login` (10/min per IP+username) and `/api/v1/setup` POST (5/min per IP); Task 14 applies it to `/api/v1/kid/login` (5/min per device IP — 4-digit PINs). Public registration: `POST /api/v1/auth/register` (and any other self-signup) → 403 `"Ask a parent to add you."` once setup is done; new parents come from a parent-only invite endpoint `POST /api/v1/users/invite` returning a one-time link token (24 h); test `test_register_closed_after_setup`. Cap comment bulk-create at 50 items (400 otherwise). Chat/comment per-message limits: skipped (authenticated family members only). Test `test_login_rate_limited_after_10_tries`.

- [ ] **Step 1:** `grep -rn "x_user_data\|X-User-Data\|user_data_param\|current_user_id: int = 1" backend frontend/src frontend/pages` → list every hit; all must be gone at the end.
- [ ] **Step 2:** Tests: `test_x_user_data_header_alone_is_401` (header `X-User-Data: {"user_id": <parent.id>}` on `GET /api/v1/notifications` → 401); `test_kid_cannot_award_points` (403); `test_kid_cannot_promote_self_to_parent` (`PUT /api/v1/users/{kid.id}` with `role: parent` → 403); `test_user_cannot_update_other_user` (403); `test_websocket_without_token_rejected`.
- [ ] **Step 3–4:** FAIL → implement → PASS. Frontend: `npm run lint && npm run type-check` pass; frontend calls that relied on `X-User-Data` now send the bearer token.
- [ ] **Step 5:** Commit `fix(security): remove spoofable header identity and enforce authz`.

### Task 8: Lock models

**Files:**
- Create: `backend/app/models/lock.py`, register in `models/__init__.py`
- Test: `backend/tests/test_lock_models.py`

**Interfaces — Produces** (all `Column` style, matching existing models):
- `Device` (`devices`): `id`, `mac: str` unique lowercase `aa:bb:cc:dd:ee:ff`, `name: str`, `vendor: str|None`, `hostname: str|None`, `ip: str|None`, `ipv6: JSON list|None`, `status: str` in `{"unassigned","assigned","guest"}` default `"unassigned"`, `first_seen`, `last_seen`; relationships `owners` (User, via `device_owners`), `groups` (DeviceGroup, via `device_group_members`).
- `DeviceGroup` (`device_groups`): `id`, `name` unique.
- `TimeWindow` (`time_windows`): `id`, `kind` in `{"allowed","free"}`, `days: str` (digits `0`=Mon…`6`=Sun, e.g. `"01234"`), `start: str "HH:MM"`, `end: str "HH:MM"`, `kid_id` FK users nullable, `group_id` FK device_groups nullable (exactly one set — `CheckConstraint`).
- `Override` (`overrides`): `id`, `device_id` FK, `action` in `{"lock","unlock"}`, `source` in `{"manual","bonus"}`, `expires_at: datetime|None` (UTC), `created_at`, `created_by_id` FK users nullable.

- [ ] **Step 1:** Tests: `test_device_mac_unique`, `test_window_requires_exactly_one_target` (IntegrityError when both/neither), `test_device_owners_many_to_many`.
- [ ] **Step 2–4:** FAIL → implement → PASS; migration revision. **Step 5:** Commit `feat(lock): device, group, window, override models`.

### Task 9: Schedule helpers (pure)

**Files:** Create `backend/app/lock/__init__.py`, `backend/app/lock/schedule.py`; Test `backend/tests/lock/test_schedule.py`

**Interfaces — Produces:**
- `@dataclass(frozen=True) class Window: days: frozenset[int]; start: time; end: time` and `Window.from_row(row: TimeWindow) -> Window`.
- `in_window(w: Window, now_local: datetime) -> bool`. `start < end`: same-day range `[start, end)`. `start > end`: wraps midnight — true if (`weekday in days` and `t >= start`) or (`(weekday-1)%7 in days` and `t < end`). `start == end`: whole day if `weekday in days`.
- `occurs_on(pattern: dict, d: date) -> bool`: `{"type":"daily"}` → True; `{"type":"weekly","days":[0..6]}` → `d.weekday() in days`; else False.
- `local_now(tz: str, now_utc: datetime) -> datetime` via `zoneinfo.ZoneInfo`.

- [ ] **Step 1:** Tests (exact): `in_window(Window({0},time(16),time(20)), Mon 16:00)` True; Mon 20:00 False; Tue 17:00 False; wrap `Window({0},time(20),time(2))` at Tue 01:00 True, Tue 02:00 False, Mon 19:59 False; `occurs_on({"type":"weekly","days":[5,6]}, date(2026,10,24))` True (Saturday), `date(2026,10,26)` False; `occurs_on({"type":"monthly"}, ...)` False.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(lock): schedule helpers`.

### Task 10: Rule engine (pure)

**Files:** Create `backend/app/lock/rules.py`; Test `backend/tests/lock/test_rules.py`

**Interfaces — Consumes:** `Window`, `in_window` (Task 9). **Produces:**
```python
@dataclass(frozen=True)
class OwnerChores:
    total: int      # today's chore instances, excluding cancelled
    approved: int   # status done

@dataclass(frozen=True)
class DeviceFacts:
    status: str                                  # unassigned | assigned | guest
    owners: tuple[OwnerChores, ...]
    allowed_sets: tuple[tuple[Window, ...], ...] # one tuple per owner/group that HAS allowed windows
    free: tuple[Window, ...]                     # union of owners' + groups' free windows
    override: str | None                         # newest unexpired: "lock" | "unlock" | None
    bonus_active: bool
    new_devices_blocked: bool
    points_unlock_early: bool

def is_online(f: DeviceFacts, now_local: datetime) -> bool
```
Order (implement exactly):
```
if override == "lock": False
if status == "guest": True
if status == "unassigned": override == "unlock" or not new_devices_blocked
allowed = all(any(in_window(w, now) for w in s) for s in allowed_sets)   # empty → True
if not allowed: False
chores_ok = all(o.total == 0 or o.approved == o.total for o in owners)
return chores_ok or any(in_window(w, now) for w in free) or override == "unlock" \
       or (bonus_active and points_unlock_early)
```
(Bonus when chores are already ok changes nothing; see note at end of plan.)

- [ ] **Step 1:** Tests, one per line of the order above, plus: `test_shared_device_one_owner_no_chores_other_pending_is_offline` (owners `(OwnerChores(0,0), OwnerChores(2,1))` → False); `test_no_windows_no_chores_online_all_day`; `test_unlock_still_respects_allowed_hours`; `test_free_time_unlocks_with_pending_chores`; `test_group_and_kid_allowed_both_required` (two allowed sets, now inside only one → False).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(lock): rule engine`.

### Task 11: Daily reset + chores API

**Files:**
- Create: `backend/app/lock/reset.py`, `backend/app/api/chores.py` (prefix `/api/v1/chores`), `backend/app/schemas/chore.py`
- Test: `backend/tests/lock/test_reset.py`, `backend/tests/test_chores_api.py`

**Interfaces — Consumes:** `occurs_on`, `local_now`, `get_family`, `require_parent`. **Produces:**
- Chore definition = `Task(is_recurring=True, recurrence_pattern=..., assigned_to_id=kid, points=..., parent_task_id=None)`. Instance = `Task(is_recurring=False, parent_task_id=def.id, due_date=<chore day at 00:00>, status=todo)`. One-time chore = instance with `parent_task_id=None` and `due_date=chore day`.
- `reset_due(fam: FamilySettings, now_local: datetime) -> bool`: `now_local.time() >= reset_time and fam.last_reset_date != now_local.date()`.
- `run_reset(db, day: date) -> int`: mark instances with `due_date < day` and status not `done` as `cancelled`; create missing instances for definitions where `occurs_on(pattern, day)` (skip if instance with same `parent_task_id` and `due_date` exists); set `last_reset_date = day`; return created count.
- `chore_day(fam) -> date | None` = `fam.last_reset_date` ("today" for every rule/query).
- `chore_counts(db, kid_id: int, day: date) -> OwnerChores`.
- API: `POST /` (parent) body `{title, kid_id, points=10, repeat: {"type":"daily"|"weekly"|"once","days":[...]}, needs_photo=false}` → definition (+ instance for current chore day if it occurs today or is `once`); `GET /today` (parent) → today's instances grouped by kid; `POST /{id}/approve` (parent) → status `done`, `approved_at`, `approved_by_id`, `completed_at`; 409 `"This chore isn't waiting for approval."` unless `submitted_for_approval`; `DELETE /{definition_id}` (parent). Store `needs_photo` in `recurrence_pattern["needs_photo"]` (ponytail: no new column).

- [ ] **Step 1:** Tests: `test_reset_creates_daily_instances_once` (run twice same day → second returns 0); `test_reset_cancels_unfinished_yesterday`; `test_weekly_chore_only_on_its_days`; `test_before_reset_time_yesterday_still_counts` (fam tz UTC, reset 06:00, last_reset 2026-10-20, now 2026-10-21 03:00 → `reset_due` False, `chore_day` = 2026-10-20); `test_dst_day_resets_once` (tz `America/New_York`, loop `now_utc` over 2026-11-01 every 30 min, call reset when due → exactly 1 reset); `test_approve_requires_submitted`; `test_kid_cannot_approve` (403).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(chores): daily reset and approval API`.

### Task 12: State loop, blocker client, device reports

**Files:**
- Create: `backend/app/lock/state.py`, `backend/app/lock/blocker_client.py`, `backend/app/lock/loop.py`, `backend/app/api/internal.py` (prefix `/api/v1/internal`)
- Modify: `backend/app/main.py` (startup: `asyncio.create_task(run_forever())`; shutdown: cancel), `core/config.py` (`BLOCKER_URL = "http://127.0.0.1:7777"`, `LOCK_INTERVAL_SECONDS = 30`)
- Test: `backend/tests/lock/test_state.py`, `backend/tests/test_internal_api.py`

**Interfaces — Consumes:** `is_online`, `DeviceFacts`, `run_reset`, `reset_due`, `chore_counts`, `Window.from_row`. **Produces:**
- `device_facts(db, device: Device, fam, now_utc) -> DeviceFacts` (newest unexpired override; `bonus_active` = unexpired override with `source="bonus"`).
- `desired_blocked(db, now_utc: datetime) -> list[str]` → sorted MACs that must be offline.
- `tick(db, now_utc) -> list[str]`: reset if due, delete expired overrides, return `desired_blocked`.
- `push_blocked(macs: list[str]) -> bool`: `httpx.post(f"{BLOCKER_URL}/state", json={"blocked": macs}, headers={"X-Internal-Token": token}, timeout=5)`; log and return False on error (never raise).
- `run_forever()`: every `LOCK_INTERVAL_SECONDS`, own `SessionLocal()`, `tick` → `push_blocked`. Also exposes `trigger()` (an `asyncio.Event`) so API writes can call `lock.loop.trigger()` for immediate re-evaluation.
- `POST /api/v1/internal/devices/seen` header `X-Internal-Token` (403 otherwise), body `{mac, ip, ipv6: [], hostname, vendor}` → upsert by lowercase MAC; new devices get `status="unassigned"`, `name = hostname or vendor or "Unknown device"`. `GET /api/v1/internal/state` → `{"blocked": [...]}` (blocker pulls on its own startup).

- [ ] **Step 1:** Tests: `test_new_device_report_creates_unassigned_blocked` (report → `desired_blocked` contains MAC); `test_guest_never_blocked`; `test_kid_device_unblocked_after_all_approved`; `test_expired_override_ignored`; `test_seen_without_token_403`; `test_push_blocked_returns_false_when_blocker_down` (unreachable port).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(lock): state loop and blocker client`.

### Task 13: Parent APIs — devices, groups, kids, windows, family, today

**Files:**
- Create: `backend/app/api/devices.py` (`/api/v1/devices`, `/api/v1/groups`), `backend/app/api/kids.py` (`/api/v1/kids`), `backend/app/api/windows.py` (`/api/v1/windows`), `backend/app/api/family.py` (`/api/v1/family`, `/api/v1/today`), `backend/app/lock/overrides.py`, `backend/app/schemas/lock.py`
- Test: `backend/tests/test_parent_api.py`

**Interfaces — Consumes:** `require_parent`, models, `chore_counts`, `device_facts`/`is_online`, `trigger`. **Produces** (all require parent; every write calls `trigger()`):
- `set_override(db, device_ids: list[int], action: str, minutes: int | None, user_id: int) -> None` (replaces existing manual overrides on those devices); `clear_override(db, device_ids) -> None`.
- Devices: `GET /devices` → `[{id, name, mac, vendor, status, owner_ids, group_ids, online: bool, override: {action, expires_at}|null, last_seen}]`; `PATCH /devices/{id}` `{name?, status?, owner_ids?, group_ids?}` (`owner_ids` non-empty sets status `assigned`); `POST /devices/{id}/override` `{action: "lock"|"unlock", minutes: int|null}`; `DELETE /devices/{id}/override`.
- Groups: `GET/POST /groups`, `PATCH/DELETE /groups/{id}` `{name, device_ids}`, `POST/DELETE /groups/{id}/override` (applies to members).
- Kids: `GET/POST /kids` `{full_name, avatar, pin?}` (username auto `kid-<slug>`, random unusable password, `pin_hash` via password hasher), `PATCH/DELETE /kids/{id}`, `POST/DELETE /kids/{id}/override` (all devices owned).
- Windows: `GET /windows?kid_id=&group_id=`, `POST /windows` `{kind, days, start, end, kid_id|group_id}` (400 `"Pick a kid or a group, not both."`), `DELETE /windows/{id}`.
- Family: `GET /family`, `PATCH /family` `{name?, timezone?, reset_time?, new_devices_blocked?, points_unlock_early?}` (validate tz with `ZoneInfo`, 400 `"Unknown time zone."`; time zone change takes effect next reset — no immediate reset).
- `GET /today` → `{day, pending_approvals: int, new_devices: [device], kids: [{id, name, avatar, online_all: bool, chores: [{id, title, points, state: "done"|"needs_you"|"todo"}], devices: [{id, name, vendor, online}]}]}`. This is the Plan 3 home-screen contract.

- [ ] **Step 1:** Tests: `test_assign_owner_marks_assigned`; `test_unlock_timer_expires` (override 1 min, `tick` at now+2 min → device back to rule result); `test_group_override_applies_to_members`; `test_kid_override_hits_all_owned_devices`; `test_window_both_targets_400`; `test_bad_timezone_400`; `test_today_shape` (keys above, chore states); `test_kid_token_gets_403_on_patch_family`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Keep each api file <300 lines. **Step 5:** Commit `feat(api): parent device, kid, window and family endpoints`.

### Task 14: Kid API (identify by device)

**Files:** Create `backend/app/api/kid.py` (`/api/v1/kid`), `backend/app/core/client_ip.py`; Test `backend/tests/test_kid_api.py`

**Interfaces — Produces:**
- `client_ip(request) -> str`: if `request.client.host` in `{"127.0.0.1","::1"}` and header `X-Real-IP` present → header value; else `request.client.host`. (Plan 3's Next.js proxy must set `X-Real-IP`.)
- `GET /kid/whoami` (no auth) → `{device: {id,name}|null, kids: [{id, full_name, avatar, has_pin}]}` (owners of the device matching `client_ip` by `ip` or in `ipv6`).
- `POST /kid/login` `{kid_id, pin?}` → `{access_token}` (role kid). Rate limited via `core.ratelimit.limit(f"kid:{ip}", 5, 60)` (Task 7A); test `test_kid_login_rate_limited`. Allowed only if `kid_id` owns the requesting device; 403 `"This device doesn't belong to you. Ask a parent."`; 401 `"Wrong PIN. Try again."` if PIN set and wrong.
- `GET /kid/today` (kid token) → `{locked: bool, chores: [{id,title,points,state}], points_balance: int}`; `POST /kid/chores/{id}/done` (kid token, own chore only, else 403) → status `submitted_for_approval`, `submitted_for_approval_at`; calls `trigger()`.

- [ ] **Step 1:** Tests: `test_whoami_unknown_ip_returns_null_device`; `test_login_from_other_kids_device_403`; `test_login_wrong_pin_401`; `test_kid_marks_own_chore_done`; `test_kid_cannot_mark_other_kids_chore` (403); `test_x_real_ip_ignored_from_non_loopback`. Use `TestClient(app, client=("192.168.1.50", 5000))` (Starlette ≥0.36) or set `request.scope["client"]` via a tiny middleware in the test.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(api): kid endpoints identified by device`.

### Task 15: Wrap-up

- [ ] **Step 1:** `cd backend && ruff format --check . && ruff check . && python -m pytest tests -q` — all green.
- [ ] **Step 2:** `docker compose up --build` → `curl localhost:8000/health` healthy; `curl localhost:8000/api/v1/setup` → `{"needed": true}`; compose has only `backend` + `frontend`.
- [ ] **Step 3:** Commit any fixes; open PR `feat/v2-core` → `main` (ask owner before pushing).

---

**Note for owner (spec gap):** With the spec's rule, bonus time only changes anything when "points can unlock early" is on. Once chores are approved the device is already online for all allowed hours, and bonus can't go past them. Implemented exactly per spec; revisit in v2.1 (e.g. make bonus extend past allowed hours by N minutes, or have allowed hours become a daily screen-time budget).
