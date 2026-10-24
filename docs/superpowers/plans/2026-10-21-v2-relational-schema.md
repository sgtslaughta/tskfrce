# v2 Relational schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move chores off the legacy `tasks` table onto a relational chore library (chores → assignments → runs), add enforced FKs/CHECKs everywhere v2 stores data, add a notifications inbox and "Give bonus points", and remove the legacy app and its data.

**Architecture:** New SQLAlchemy models in `backend/app/models/chores.py`; one service module `backend/app/services/chores.py` owns generation, the kid filter and run state; existing routes keep their paths and response shapes with run ids. Alembic revisions are forward-only; the first one copies data into the new tables, the last one drops legacy tables and old columns. Frontend gets a library + assignment editor, a notification bell and a bonus-points form; legacy UI is deleted.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic (SQLite, batch mode), pytest; Next.js + Mantine + TanStack Query, Jest; Docker lab + Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-v2-relational-schema-design.md` (approved). Read it first; tables, constraints, routes, migration steps and owner decisions are defined there and not repeated here.

## Global Constraints

- Every relationship is an enforced FK; every closed value set has a CHECK (exact sets in the spec). No ids in JSON or strings.
- Runs never copy title/points/steps/needs_photo; they read the chore. Points amounts are fixed in the `points` row at approval.
- Route paths and JSON shapes for run-level endpoints (`/chores/today`, `/chores/{id}/approve|send-back`, `/kid/today`, `/kid/chores/{id}/...`, `/today`, needs-you, chat `chore` threads, `/chore-photos/...`) stay as they are, with run ids; response field `subtasks` keeps its name.
- "Today" for a family is always computed in the family timezone (`family_settings.timezone`) with the reset time; never `date.today()`/UTC date.
- Alembic: forward-only (each new revision's `downgrade()` raises `NotImplementedError("forward-only")`), single head. Current head before this plan: `a7b8c9d0e1f2` (check `alembic heads`; a GIF fix may add one).
- Before upgrading, `backend/entrypoint.sh` copies the DB to `DATA_DIR/backups/pre-upgrade-<UTC yyyymmddHHMMSS>.db` when `alembic current` ≠ `alembic heads`.
- Copy tone as elsewhere (plain, friendly, a next step). UI uses theme tokens (`var(--f-*)`, `--f-head-*`) and existing `.m-form`/`.m-actions`/Drawer patterns; must match approved mockups in light and dark, and work at 360 px.
- Files < 500 lines. Semantic commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commands: backend `cd backend && uv run --quiet --no-project --with-requirements requirements.txt python -m pytest tests -q -p no:logging -o addopts=""`; lint `uvx ruff format --check . && uvx ruff check .`; never plain `uv run` (if root `uv.lock` changes, `git checkout uv.lock`); frontend `npx jest && npm run type-check && npm run lint`.

## Review Focus

1. **Migration on a real family DB mid-day:** a kid with a submitted-but-unapproved chore, a race chore already taken, a sent-back chore on attempt 2 → after upgrade the same items are in Needs you with the same attempt/note, and nobody's blocked/online state changes. (Task 1 migration test + Task 6 full-head test.)
2. **Edit while in flight:** parent renames a chore and adds a step while a kid has it submitted → kid and Needs you show the new title; submission stands; approval awards the chore's points at approval time. (Task 2 test.)
3. **Double generation:** reset runs twice for the same day (box restart, two workers) → exactly one run per kid / per shared assignment. (Task 2 test against the unique indexes.)
4. **UTC midnight with a non-UTC family:** family tz `America/New_York`, now = 00:30 UTC → today's runs are for the local date; the previously failing `test_kid_cannot_preempt_tomorrows_instance` passes at any wall-clock time. (Task 2 test with frozen time.)
5. **Deleting things that are pointed at:** delete a kid with runs, notifications, flair and badges; archive a chore with history; delete a custom badge that was awarded → no FK errors, no orphans, history pages still render. (Tasks 2, 4, 5 tests.)

---

### Task 1: Chore library schema and data migration

**Files:**
- Create: `backend/app/models/chores.py` (`Chore`, `ChoreStep`, `ChoreAssignment`, `assignment_kids`, `ChoreRun`, `run_kids`, `RunStepTick`)
- Modify: `backend/app/models/__init__.py`, `backend/app/core/database.py` (`_import_all_models`), `backend/app/models/chore_extra.py` (`ChorePhoto.run_id` nullable FK added alongside `task_id`), `backend/app/models/chat.py` (`Thread.run_id` nullable FK added alongside `task_id`), `backend/app/models/gamification.py` (`Points.run_id`, `Points.redemption_id` nullable FKs added)
- Create: `backend/alembic/versions/b8c9d0e1f2a3_chore_library.py`
- Modify: `backend/entrypoint.sh` (backup step, see Global Constraints)
- Create: `backend/tests/test_migrate_chores.py`

**Interfaces:**
- Produces: models with the exact tables/columns/constraints in the spec's Data model table; `ChoreRun.kids` relationship (secondary `run_kids`), `ChoreRun.assignment`, `ChoreAssignment.chore`, `ChoreAssignment.kids`, `Chore.steps` (ordered by position), `Chore.assignments`.
- Old `tasks` rows and old columns stay in place in this task (dropped in Task 6); after this task both exist and only old code runs.

- [ ] **Step 1: Write failing `test_migrate_chores.py`:** build a temp SQLite DB with `alembic upgrade a7b8c9d0e1f2` (subprocess, like `tests/test_migrations.py`), insert fixtures with raw SQL: a daily definition for 2 kids `each` with 2 subtasks + needs_photo + due_time; a weekly `race` definition (days [0,2,4]) with today's shared instance taken (SUBMITTED by kid2) and `chore_participants`; a `team` instance DONE + approved with two `points` rows (`reference_type='task'`); a sent-back instance (attempt 2, last_note "Missed a spot") with a photo on attempt 2 and a chore thread with 2 messages; a one-time chore instance (parent_task_id NULL); a deleted definition (is_recurring false, CANCELLED). Upgrade to `b8c9d0e1f2a3`. Assert: 5 chores (deleted one has `archived_at`), steps match subtasks in order, assignments have mode/repeat/days/due_time/kids from the pattern, one `once` assignment with `on_date` = instance day, run count = instance count with mapped statuses/attempt/last_note/submitted_by/approved_by, `run_kids` = participants, ticks only for done subtasks, `chore_photos.run_id`, `threads.run_id`, `points.run_id` filled for every chore-linked row.
- [ ] **Step 2: Run** `... pytest tests/test_migrate_chores.py -q` → FAIL (revision missing).
- [ ] **Step 3: Implement models + revision** (create tables, then data copy with `op.get_bind()` SQL in Python loops; steps 3–6 of the spec's Migration section for chores, photos, threads, points). Entrypoint backup step.
- [ ] **Step 4: Run** the new test, `tests/test_migrations.py`, full backend suite, ruff → PASS (old code untouched, still green).
- [ ] **Step 5: Commit** `feat(db): chore library tables and data migration`

---

### Task 2: Switch all chore code to runs

**Files:**
- Create: `backend/app/services/chores.py`
- Modify: `backend/app/lock/reset.py` (keep `reset_due`, `current_chore_day`, `midnight` there; move chore logic to the service), `backend/app/lock/state.py`, `backend/app/lock/schedule.py` (`occurs_on(assignment, day)`), `backend/app/api/chores.py` (library + assignment routes; split into `backend/app/api/chore_library.py` if > 500 lines), `backend/app/api/kid.py`, `backend/app/api/family.py`, `backend/app/api/kids.py` (`delete_kid`), `backend/app/api/chore_photos.py`, `backend/app/api/community.py`, `backend/app/services/economy.py`, `backend/app/services/progression.py`, `backend/app/services/badges.py`, `backend/app/services/chat.py`, `backend/app/services/photos.py` (`save_photo(upload, run, user)`), `backend/app/schemas/chore.py`, `backend/app/api/setup*` (starter chores → chore + assignment)
- Test: rewrite onto runs: `tests/lock/test_reset.py`, `tests/lock/test_state.py`, `test_chores_api.py`, `test_chore_sharing.py`, `test_chore_sharing_cleanup.py`, `test_chore_proof.py`, `test_kid_api.py`, `test_today_payload.py`, `test_parent_api.py`, `test_economy.py`, `test_progression.py`, `test_badges.py`, `test_chat.py`, `test_e2e_lock.py`; create `tests/test_chore_library.py`

**Interfaces:**
- Consumes: Task 1 models.
- Produces (`app/services/chores.py`):
  - `today(db) -> date` (family tz + reset time; replaces every chore use of `current_chore_day`)
  - `generate(db, day: date) -> list[ChoreRun]` (idempotent; relies on the unique indexes; catches `IntegrityError` per run)
  - `kid_runs_filter(kid_id: int)` → SQLAlchemy clause (`kid_id == kid` OR exists in `run_kids`)
  - `run_kid_ids(run) -> list[int]`, `counts(db, kid_id, day) -> tuple[approved:int, total:int]`
  - `chore_out(run) -> dict` (same keys as today's `ChoreOut`, values read from the chore)
- Routes (spec "API changes"): `GET/POST /api/v1/chores`, `PATCH/DELETE /api/v1/chores/{id}`, `POST /api/v1/chores/{id}/copy`, `POST /api/v1/chores/{id}/assignments`, `PATCH/DELETE /api/v1/assignments/{id}`; schemas `ChoreIn{title, points, needs_photo, steps:[str]}`, `ChoreLibOut`, `AssignmentIn{kid_ids, mode, repeat:{type, days}, on_date, due_time}`, `AssignmentOut`. Remove `GET /chores/definitions`.
- Legacy `tasks` code paths stop being read for chores; `api/tasks.py` `_is_chore` guard deleted with Task 6.

- [ ] **Step 1: Failing tests in `test_chore_library.py`:** create chore with steps → no runs; add assignment for 2 kids `each` → today's 2 runs (if occurs today); `race` with 1 kid stored as `each`; empty `kid_ids` → 422; `once` with `on_date` today → run today, `on_date` editable, edit doesn't touch existing runs; copy duplicates chore+steps without assignments; **Review Focus 2:** rename + add step while run submitted → `/kid/today` and `/today` show new title and step, status still submitted, approve awards chore points at approval time; delete chore with runs → archived, assignments inactive, history in `/today` of that day still renders; delete chore without runs → gone; **Review Focus 3:** `generate(db, d)` twice → same run count; **Review Focus 4:** freeze time to 2026-10-22 00:30 UTC, family tz `America/New_York` reset `06:00` → `today()` = 2026-10-21 and generated runs carry that day.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the service and switch every caller listed under Files; existing tests ported to create chores via the library API or service helpers (add `tests/factories.py` `make_chore(db, title, points=10, kids=[...], mode="each", repeat="daily", steps=[], needs_photo=False) -> (Chore, ChoreAssignment)` if it saves repetition).
- [ ] **Step 4: Run** full backend suite + ruff → PASS (including `test_kid_cannot_preempt_tomorrows_instance` at any time of day).
- [ ] **Step 5: Commit** `refactor(chores): runs from a reusable chore library`

---

### Task 3: Integrity fixes

**Files:**
- Create: `backend/alembic/versions/c9d0e1f2a3b4_integrity.py`
- Modify: `backend/app/models/badge.py`, `backend/app/models/user.py` (drop `flair` attr after migration; add `KidFlair` in `backend/app/models/flair.py`), `backend/app/models/reward.py`, `backend/app/models/lock.py` (`DeviceIPv6`), `backend/app/models/chat.py` (CHECKs), `backend/app/models/gamification.py` (`Points.reason`), `backend/app/services/badges.py`, `backend/app/flair/catalog.py`, `backend/app/api/flair.py`, `backend/app/services/economy.py`, `backend/app/api/redemptions.py`, `backend/app/api/internal.py`, `backend/app/api/kid.py` (`request_device`)
- Test: `backend/tests/test_integrity.py`; update `test_flair.py`, `test_badges.py`, `test_redemptions.py`, `test_internal*.py`

**Interfaces:**
- Produces: `BadgeAward.custom_badge_id`; `KidFlair(kid_id, slot, item_id)`, `equipped(db, kid_id) -> dict[str, str]` (same return shape as today); `DeviceIPv6(device_id, address)`; `Points.reason` CHECK IN (chore, early_bonus, team_share, redemption, bonus, adjustment); `Points.reference_type/reference_id` dropped.

- [ ] **Step 1: Failing tests:** each CHECK rejects a bad value with `IntegrityError` (redemption kind/status and kind⇔reward_id/minutes, thread kind, message kind, points reason, flair slot, badge exactly-one); `GET /redemptions?status=bogus` → 422; awarding custom badge stores `custom_badge_id`, `badge_info` works, deleting (deactivating) it keeps the award rendering; flair PUT round-trips via `kid_flair`; `/internal/devices/seen` replaces a device's IPv6 rows; kid login by IPv6 address finds the device; migration test: DB at Task 2 head with `custom:<id>` award, flair JSON, ipv6 JSON, points with reference ids → upgraded values equal.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (migration copies then drops `users.flair`, `devices.ipv6`, `points.reference_*` via batch mode).
- [ ] **Step 4: Run** full suite + ruff → PASS.
- [ ] **Step 5: Commit** `feat(db): enforce badge, flair, ledger, redemption and address integrity`

---

### Task 4: Notifications inbox and bonus points (backend)

**Files:**
- Create: `backend/alembic/versions/d0e1f2a3b4c5_notifications_v2.py` (drop and recreate `notifications` per spec)
- Create: `backend/app/models/inbox.py` (`Notification`), `backend/app/services/inbox.py`, `backend/app/api/inbox.py` (prefix `/api/v1/notifications`)
- Modify: write points in `backend/app/api/kid.py` (`/done` → chore_submitted), `backend/app/services/economy.py` (redemption request/decide), `backend/app/api/internal.py` (resisting, new device), `backend/app/services/badges.py` + `progression.py` (badge_earned, level_up), `backend/app/api/kids.py` (bonus route), `backend/app/main.py`
- Test: `backend/tests/test_inbox.py`, `backend/tests/test_bonus_points.py`

**Interfaces:**
- Produces: `inbox.notify(db, user_ids: list[int], kind: str, title: str, body: str | None = None, *, run_id=None, redemption_id=None, device_id=None, thread_id=None) -> None` (no commit; caller's transaction); `inbox.parents(db) -> list[int]`.
- Routes: `GET /notifications?unread=&before=` → `{items:[{id, kind, title, body, created_at, read, run_id, redemption_id, device_id, thread_id}], unread, has_more}` (own only, 50 per page); `POST /notifications/{id}/read` (404 if not own); `POST /notifications/read-all`; `POST /api/v1/kids/{id}/points {amount:int 1..500, note:str 1..100}` → `{balance}` (parent only; `points.reason='bonus'`; kid celebration item like a reward).

- [ ] **Step 1: Failing tests:** kid submits → each parent gets one chore_submitted with `run_id`; redemption request → parents; decision → kid; resisting/new device → parents; badge/level → kid; kid can't read or mark a parent's notification (404); `unread` count and `read-all`; deleting a kid / run / device cascades its notifications; bonus: 0 or 501 → 422, empty note → 422, kid token → 403, success raises balance by amount, appears in `/kid/celebrations`, notification `bonus` is NOT a kind (no notification needed — celebration covers it).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Remove the old notification writes these replace.
- [ ] **Step 4: Run** full suite + ruff → PASS.
- [ ] **Step 5: Commit** `feat(api): notifications inbox and parent bonus points`

---

### Task 5: Remove legacy backend

**Files:**
- Delete routers/services/schemas/models/tests for: tasks, goals, gamification (keep `Points`/`PointsType` — move to `backend/app/models/points.py`), lists, media, comments, workflow, messages, mentions, presence, legacy notifications, `/ws` websocket; `TaskService`, `GoalService`, `PermissionService` if unused after.
- Modify: `backend/app/main.py`, `backend/app/api/deps.py` (drop task/conversation lookups), `backend/app/core/database.py` (`_import_all_models`), `backend/tests/test_auth_hardening.py` (keep only v2 route cases)
- Create: `backend/alembic/versions/e1f2a3b4c5d6_drop_legacy.py` (drop every legacy table listed in the spec, `tasks`, `chore_participants`, `chore_subtasks`, `chore_photos.task_id`, `threads.task_id`)
- Test: `tests/test_migrations.py` still passes; new `tests/test_legacy_gone.py`

- [ ] **Step 1: Failing test `test_legacy_gone.py`:** each removed prefix (`/api/v1/tasks/`, `/goals/`, `/gamification/`, `/lists/`, `/media/`, `/comments/`, `/workflow/`, `/messages/`, `/mentions/`, `/presence/`) → 404 for a logged-in parent; `/ws/notifications` not routed; after `alembic upgrade head` none of the legacy table names exist.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Delete and migrate.** `grep -rn` for every removed module name returns nothing outside `alembic/versions/`.
- [ ] **Step 4: Run** full suite + ruff + `tests/test_migrate_chores.py` (extend: upgrade fixtures to head; **Review Focus 1:** assert `/today` needs-you items, attempts, notes and `lock.state.desired_blocked` per kid equal the values computed before upgrade).
- [ ] **Step 5: Commit** `refactor!: remove legacy app backend and tables`

---

### Task 6: Chore library UI

**Files:**
- Modify: `frontend/src/v2/types.ts` (`LibChore`, `Assignment`; remove `Chore` definitions type), `frontend/src/v2/hooks/useChores.ts` (`useLibrary`, `useSaveChore`, `useDeleteChore`, `useCopyChore`, `useSaveAssignment`, `useDeleteAssignment`), `frontend/src/v2/manage/KidsPage.tsx`, `frontend/src/v2/manage/ChoreEditor.tsx` (chore fields only), `frontend/src/v2/setup/StepChores.tsx`, `frontend/src/v2/setup/starterChores.ts`, `frontend/pages/setup.tsx`
- Create: `frontend/src/v2/manage/ChoreLibrary.tsx` (list), `frontend/src/v2/manage/AssignmentForm.tsx`
- Test: `frontend/tests/v2/choreLibrary.test.tsx`; update tests using `/chores/definitions`

**Interfaces:**
- Consumes: Task 2 routes/shapes.
- UI (spec "Frontend changes"): Chores section = library rows (title, points, steps count, photo icon, "Used by" avatars, archived hidden); kid chips filter by assignment; Drawer = chore fields + "Assignments" list + "Assign" → AssignmentForm (kid chips, mode SegmentedControl only with 2+ kids, repeat Every day / Some days (day chips) / One time (date input), due time). Copy action on a row. Delete confirm says "Chores already done stay in history."

- [ ] **Step 1: Failing tests:** library renders rows from `GET /chores`; kid chip filters; saving a chore PATCHes only chore fields; Assign posts `AssignmentIn` with exact keys; mode control hidden with 1 kid; One time requires a date (Save disabled); delete calls DELETE and toast; setup wizard posts chore then assignment.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** jest + type-check + lint → PASS.
- [ ] **Step 5: Commit** `feat(frontend): chore library and assignments`

---

### Task 7: Notification bell and bonus points UI

**Files:**
- Create: `frontend/src/v2/hooks/useInbox.ts` (`useInbox(kid)`, polling 30 s, `refetchIntervalInBackground: false`; `useMarkRead`, `useMarkAllRead`), `frontend/src/v2/components/Bell.tsx`, `frontend/src/v2/components/bell.css` (import in `pages/_app.tsx`)
- Modify: `frontend/src/v2/components/FridgeShell.tsx` (bell in top bar), `frontend/src/v2/kid/KidPage.tsx` (bell in header, kid token), kid profile drawer (find it under `frontend/src/v2/` — "Give bonus points" button + form: amount NumberInput 1–500, note TextInput ≤ 100), `frontend/src/v2/hooks/useKids.ts` or nearest (`useBonus`)
- Test: `frontend/tests/v2/bell.test.tsx`, `frontend/tests/v2/bonus.test.tsx`

- [ ] **Step 1: Failing tests:** bell shows unread count (hidden at 0, "9+" over 9); opening lists items newest first; clicking an item marks it read and navigates (`run_id` → `/` Today needs-you, `device_id` → `/devices?focus=<id>`, `redemption_id` → `/`; kid items → kid page); "Mark all read" calls read-all; kid bell uses kid token; bonus form validates 1–500 and note required, posts exact body, shows "Sent! <name> got +N".
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (theme tokens; popover on desktop, full sheet < 768 px like the chat dock). **Step 4:** jest + type-check + lint → PASS.
- [ ] **Step 5: Commit** `feat(frontend): notification bell and bonus points`

---

### Task 8: Remove legacy frontend

**Files:**
- Delete: `frontend/pages/hub.tsx` and every component/service/context/hook reachable only from it or from `AppLayout` (e.g. `src/components/**` legacy, `src/services/{task,goal,gamification,list,media,comment,workflow,taskHistory,messaging,notification}Service*`, `src/contexts/NotificationContext.tsx`), their tests
- Modify: `frontend/pages/_app.tsx` (remove `NotificationProvider` and any legacy providers no v2 page uses), `frontend/src/v2/components/FridgeShell.tsx` (remove "Old version" link)
- Test: existing suites; add `frontend/tests/v2/noLegacy.test.ts` (asserts `_app.tsx` source has no `NotificationProvider` and FridgeShell NAV has no `/hub`)

- [ ] **Step 1:** Write `noLegacy.test.ts` → FAIL.
- [ ] **Step 2: Delete** using the import graph: `npx tsc --noEmit` and `npx jest` must stay green; `grep -rn "hub\|NotificationContext\|taskService" frontend/src frontend/pages` returns nothing but v2-intended hits. Keep `tokenManager`, auth context and anything `src/v2` imports.
- [ ] **Step 3:** jest + type-check + lint + `npx next build` → PASS.
- [ ] **Step 4: Commit** `refactor(frontend)!: remove legacy app`

---

### Task 9: Lab journeys and browser e2e on the new model

Runs after Tasks 1–8 are merged.

**Files:**
- Modify: `blocker/tests/lab/journey.py` (chore helpers use library + assignment; points via `POST /kids/{id}/points`), `blocker/tests/lab/test_journey_*.py`, `frontend/e2e/seed.ts`, `frontend/e2e/parent.spec.ts` (create chore in library, assign race to 2 kids with 2 steps, copy, edit; bell shows the kid's submission; give bonus points), `frontend/e2e/screens.spec.ts` (bell open screenshot), `lab/e2e_run.py`
- Add a browser check that a photo upload through the Next proxy reaches the backend (regression for the proxy bug).

- [ ] **Step 1:** Update journeys and specs.
- [ ] **Step 2: Run** `bash scripts/lab.sh up && cd blocker && RUN_INTEGRATION=1 python -m pytest tests/lab -v` then `bash scripts/lab.sh e2e` → all pass (IPv6 xfail locally is expected). Run twice more for flakes.
- [ ] **Step 3: Commit** `test(lab): journeys and e2e on the chore library`
