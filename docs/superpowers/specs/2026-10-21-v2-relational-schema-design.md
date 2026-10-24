# v2 Relational schema: chore library, integrity, legacy removal — Design

Status: draft for owner approval (owner answers folded in) · 2026-10-21

## Why

The owner's model of a chore: **a reusable unit, created once, assignable to anyone, many ways.** Today a chore is a row on the legacy `tasks` table whose JSON `recurrence_pattern` bundles *what* (steps, photo rule), *who* (assignees, mode) and *when* (repeat, due time). Daily instances copy that JSON, so edits can't reach them, one-time chores vanish after use, and "reuse" means duplicating. The owner asked for "a truly relational approach to the db" and approved, in one move:

1. Chore library + assignments (replacing chore use of `tasks`).
2. Integrity fixes: badge FK, kid flair table, CHECK constraints for free-text statuses, points ledger FKs.
3. Device IPv6 addresses as rows.
4. Legacy (pre-v2) tables, routes and screens removed, and their data dropped (owner: "drop it all"; the pre-migration backup file is the only copy).
5. Notifications kept and finally shown: a v2 inbox (owner's answer).
6. Parents can give bonus points (owner's answer).

Existing data is **migrated**, not wiped.

## Goals

- Every relationship is a foreign key the database enforces (SQLite `PRAGMA foreign_keys=ON` is already set); no ids hidden in JSON or strings.
- Every closed set of values has a CHECK constraint.
- A chore edit (title, points, steps, photo rule) shows up everywhere the chore is used, including today's not-yet-approved work.
- One-time chores stay in the library for reuse.
- No user-visible behavior change outside the chore editor; blocking, points, badges, streaks, chat and photos work exactly as now.

## Non-goals

- No new chore features (no rotation, no per-assignment points override). Claude's call; easy to add on this schema later.
- No multi-family support; `family_settings` stays a singleton.
- No downgrade migration (forward-only; the upgrade backs up the DB file first — see Migration).

## Anti-goals

- Losing any approved chore history, points, photos, chat messages or badges in the migration.
- A kid becoming blocked or unblocked by the migration itself.
- Two sources of truth (old `tasks` rows kept "just in case" and drifting).

## Data model

```
chores ──< chore_steps
   │
   └──< chore_assignments ──< assignment_kids >── users(kid)
              │
              └──< chore_runs ──< run_kids >── users(kid)       (shared runs only)
                       ├──< run_step_ticks >── chore_steps
                       ├──< chore_photos
                       ├──< threads (kind=chore)
                       └──< points (run_id)
```

| Table | Columns (all FKs enforced) | Constraints |
|---|---|---|
| `chores` | id, title String(100), points Int, needs_photo Bool, created_by_id → users, created_at, updated_at, archived_at nullable | CHECK points ≥ 0 |
| `chore_steps` | id, chore_id → chores (cascade), position Int, title String(100) | UNIQUE(chore_id, position) |
| `chore_assignments` | id, chore_id → chores, mode, repeat, days String(7) nullable, on_date Date nullable, due_time String(5) nullable, active Bool, created_at | CHECK mode IN (each, race, team); CHECK repeat IN (daily, weekly, once); CHECK weekly ⇒ days not null; CHECK once ⇒ on_date not null |
| `assignment_kids` | assignment_id → chore_assignments (cascade), kid_id → users (cascade) | PK(assignment_id, kid_id) |
| `chore_runs` | id, assignment_id → chore_assignments, day Date, kid_id → users nullable, status, attempt Int, last_note String(500), submitted_at, submitted_by_id → users, approved_at, approved_by_id → users, completed_at, created_at | CHECK status IN (todo, submitted, done, cancelled); kid_id NULL ⇔ shared (race/team); partial UNIQUE(assignment_id, day, kid_id) WHERE kid_id NOT NULL; partial UNIQUE(assignment_id, day) WHERE kid_id IS NULL |
| `run_kids` | run_id → chore_runs (cascade), kid_id → users (cascade) | PK(run_id, kid_id) — participants of a shared run, snapshotted at creation |
| `run_step_ticks` | run_id → chore_runs (cascade), step_id → chore_steps (cascade), done_by_id → users, done_at | PK(run_id, step_id) |

Existing tables re-pointed: `chore_photos.task_id` → `run_id`; `threads.task_id` → `run_id` (+ CHECK kind IN (chore, private, family) and kind/ref consistency); `thread_messages` CHECK kind IN (user, system).

`days` stays the digit string used by `time_windows` (`"024"` = Mon, Wed, Fri), validated by the existing schema rule — Claude's call: it's a fixed 7-value set read only as a whole; a join table would add queries and no integrity.

### Runs read the chore live

A run has no copy of title, points, steps or photo rule; it reads them from its chore. Claude's call: this is what makes edits reach today's work, which is the point of the change. Consequences, stated so they can be checked:
- Points are awarded at approval from the chore's points *at that moment*; the `points` ledger row keeps the amount, so history never changes after approval.
- Deleting a step deletes its ticks; adding a step to a submitted run is allowed (submission already happened, it isn't re-checked).
- A chore with runs is never hard-deleted: "Delete" sets `archived_at` and deactivates its assignments; its history stays. A chore with no runs is hard-deleted.

### Generation

`run_reset` (unchanged trigger: family `reset_time`) creates today's runs from each active assignment that occurs today: `each` → one run per kid in `assignment_kids`; `race`/`team` → one shared run (`kid_id` NULL) with `run_kids` = current assignment kids. A `once` assignment occurs only on `on_date` and becomes inactive after that day. Stale `todo` runs from earlier days are cancelled, as now. Unique indexes make double generation impossible.

### Gating and the kid filter

`kid_chores_filter(kid)` = runs where `kid_id = kid` OR kid ∈ `run_kids`. `chore_counts` / `is_online` keep their meaning on runs (approved = status done with a parent `approved_by_id`).

## Integrity fixes

- **Points ledger (`points`)**: add `run_id` → chore_runs and `redemption_id` → redemptions (both nullable, indexed); CHECK at most one set; `reference_type`/`reference_id` migrated into them and dropped. Kinds stay in `points_type` (SQL enum) plus a new `reason` CHECK IN (chore, early_bonus, team_share, redemption, bonus, adjustment) replacing free text where it's machine-read; `description` stays as display text.
- **Badges**: `badge_awards.badge_key` nullable + new `custom_badge_id` → custom_badges; CHECK exactly one set; UNIQUE(kid_id, badge_key), UNIQUE(kid_id, custom_badge_id). Catalog keys stay strings (they're code, not rows). `"custom:<id>"` parsing is removed.
- **Flair**: new `kid_flair`(kid_id → users cascade, slot, item_id String(40)), PK(kid_id, slot), CHECK slot IN (card, ring, name, emblem, title); `users.flair` JSON migrated and dropped. Item validity stays in code (`catalog.equipped`).
- **Redemptions**: CHECK kind IN (screen_time, reward); CHECK status IN (pending, approved, denied); CHECK kind=reward ⇔ reward_id not null; CHECK kind=screen_time ⇔ minutes not null. `GET /redemptions?status=` validates the value (422).
- **Device addresses**: new `device_ipv6`(device_id → devices cascade, address String(45)), PK(device_id, address); `devices.ipv6` JSON migrated and dropped. `/internal/devices/seen` replaces a device's rows with the reported set; `kid.request_device` looks up by address via the table. `devices.ip` (current IPv4) stays a column — one value, no list.
- Already correct, untouched: `time_windows` CHECKs (kind, exactly one of kid/group), `devices.status`, `overrides.action/source`.

## Legacy removal

Removed (routers, services, schemas, models, tables, tests):
tasks, goals, gamification (achievements, user_achievements, streaks, leaderboards, leaderboard_entries), lists (task_lists, task_list_associations), templates/categories/tags/dependencies, media (media_attachments), comments (task_comments, comment audit/mentions), workflow (task status history), messages/presence (conversations, direct_messages, task_chat_messages, user_status), the legacy notifications router + `/ws` websocket (the table is rebuilt below), and finally the `tasks` table itself after chores move out.

Frontend: `/hub` and every legacy page/component/service/context it pulls in, the global legacy `NotificationProvider` in `_app.tsx` (replaced by the v2 inbox below), and the "Old version" nav link.

Kept: `users`, `auth`, `/users/invite`, `points` (now v2's ledger), everything under v2.

## Notifications inbox (new, owner asked to keep and show them)

Table `notifications` rebuilt relationally: id, user_id → users (cascade; the recipient), kind, title String(120), body String(300) nullable, created_at, read_at nullable, plus nullable FKs to what it's about: run_id → chore_runs, redemption_id → redemptions, device_id → devices, thread_id → threads (all `ON DELETE CASCADE`). CHECK kind IN (chore_submitted, redemption_request, redemption_decided, device_resisting, new_device, badge_earned, level_up, chat_message). Old legacy rows are dropped.

Written in the same transaction as the event, one row per recipient:
- parents ← chore_submitted (run), redemption_request (redemption), device_resisting (device), new_device (device).
- the kid ← redemption_decided (redemption), badge_earned, level_up.
- chat_message: not written per message (chat already has unread counts); Claude's call, avoids double badges.

API: `GET /api/v1/notifications?unread=` (own only, newest 50, `before` paging), `POST /notifications/{id}/read`, `POST /notifications/read-all`. Kids use the same routes with their kid token. Polling 30 s, paused when the tab is hidden (same rule as chat); the legacy websocket is not reused (Claude's call, matches chat).

UI: a bell with unread count in the top bar (parents) and on the kid page header; opens a themed popover/sheet list; each item links to where it acts (Needs you item, device drawer, kid celebrations); opening marks it read; "Mark all read". Approved theme tokens only.

## Give bonus points (new, owner approved)

`POST /api/v1/kids/{id}/points {amount: 1..500, note: 1..100 chars}` (parent only) writes a `points` row with reason `bonus` (amount > 0) — `adjustment` with negative amounts is out of scope. Kid profile drawer gets a "Give bonus points" button + small form; the kid gets a celebration like a reward. Replaces the legacy `/gamification/points/award` in the lab journey test.

## API changes (v2 frontend is the only client besides the lab tests)

- `GET/POST /chores` — library: `{id, title, points, needs_photo, steps:[{id,title}], assignments:[AssignmentOut], archived}`.
- `PATCH/DELETE /chores/{id}` — edit / archive-or-delete as above.
- `POST /chores/{id}/assignments`, `PATCH/DELETE /assignments/{id}` — `AssignmentOut = {id, chore_id, kid_ids, mode, repeat:{type, days}, on_date, due_time, active}`. Same validation messages as today's chore create (kid must exist). Claude's calls: at least one kid required (422, also on PATCH); race/team with one kid is stored as `each`, silently, as today; a `once` assignment's `on_date` is editable (that's how a one-time chore is reused), changing it never touches runs already created.
- `POST /chores/{id}/copy` stays (duplicates chore + steps, no assignments) — useful for "same chore, different points".
- Run routes keep today's paths and response shapes with run ids in place of task ids: `/chores/today`, `/chores/{run_id}/approve|send-back`, `/kid/chores/{run_id}/...`, `/today`, needs-you, chat `chore` threads (`ref` = run id), chore photos. Field `subtasks` stays the name in responses (frontend unchanged there).
- Setup wizard's starter chores create chore + one assignment each.

## Frontend changes

- Kids & chores → **Chores** section becomes the library: list of chores (title, points, steps count, photo icon, "Used by" avatars). Drawer edits the chore and lists its assignments; "Assign" opens a nested form: kids (chips), mode (each/race/team, shown with 2+ kids), repeat (every day / some days / one time + date), due time. Per-kid chips filter the list to chores assigned to that kid. Approved theme tokens and existing `.m-form`/Drawer patterns only.
- Everything else (Today, Needs you, kid checklist, chat, photos) unchanged apart from types.

## Migration (one Alembic revision chain, forward-only)

1. Copy the SQLite file to `DATA_DIR/backups/pre-relational-<timestamp>.db` before any change (in the entrypoint step that runs `alembic upgrade`, so it also covers Docker installs).
2. Create new tables.
3. Chore definitions (`tasks` with chore pattern, `is_recurring`) → `chores` + `chore_steps` (from `subtasks`) + one `chore_assignments` (+ `assignment_kids` from `assignees`). Deleted definitions (is_recurring false, CANCELLED, no longer generating) → chore with `archived_at` and inactive assignment.
4. One-time chore instances (`parent_task_id` NULL) → one chore + `once` assignment per instance group (same title/created day).
5. Instances → `chore_runs` (status TODO/IN_PROGRESS→todo, SUBMITTED_FOR_APPROVAL→submitted, DONE→done, CANCELLED→cancelled; `due_date` → day); `chore_participants` → `run_kids`; `ChoreSubtask` done rows → `run_step_ticks` matched to the chore's step by title, else by position, else dropped (only affects tick marks on old runs, never approval or points).
6. Re-point `chore_photos`, `threads`, `points` (reference ids → run_id / redemption_id), `badge_awards` (`custom:<id>` → custom_badge_id), `users.flair` → `kid_flair`, `devices.ipv6` → `device_ipv6`.
7. Drop legacy tables and old columns (SQLite batch mode).
8. A migration test builds a DB at the previous head with fixtures covering each case above, upgrades, and asserts: counts of approved runs, points sum per kid, photos, threads/messages, badges and equipped flair unchanged; every kid's online/blocked state identical before and after.

## Testing

Backend suite rewritten onto runs (same behaviors); new tests for: library CRUD, assignment validation, live edit reaches an open run, archive vs delete, once assignment reuse, unique-index double-generation guard, every CHECK rejects a bad value, ledger/badge/flair/ipv6 FKs. Lab journeys and browser e2e updated to the new chore API and editor. Frontend jest for the library and assignment form.

## Left to the builder

File layout inside `backend/app/` (suggest `models/chores.py`, `services/chores.py`), exact Pydantic schema names, how the editor's nested assign form is laid out within the approved patterns, and migration step batching.

## Known issue to fold in

`tests/test_e2e_lock.py::test_kid_cannot_preempt_tomorrows_instance` fails right after UTC midnight (run_reset returns 0 for the new UTC date). The run generator rewrite must compute "today" in the family timezone throughout; add a regression test pinned around UTC midnight with a non-UTC family timezone.
