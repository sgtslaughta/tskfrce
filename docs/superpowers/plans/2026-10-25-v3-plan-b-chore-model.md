# v3 Plan B — Chore model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chore types with kid notes, ordered steps, step deadlines, step/photo replies, deductions and computed status chips, end to end (data, API, parent UI, current kid UI).

**Architecture:** One alembic migration adds every column/table. Backend logic lives in the existing
services (`services/chores.py`, `services/chat.py`) plus one new `services/chore_types.py`; new routes
go in a new `api/chore_types.py` and the existing `api/chores.py`, `api/chore_library.py`, `api/kid.py`.
Frontend: the existing chore editor, Today and kid checklist gain the new fields. The kid screen keeps its
v2 layout (Plan C restyles it); Plan B only adds the behaviour.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (SQLite, `batch_alter_table`), pytest; Next.js pages router, React Query, Mantine, jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-v3-redesign-design.md` §5, §2.6, §3.4 (Chores), §4.2, §12. Mockups `02-parent-screens.html` (chore editor, New chore type), `03-parent-kid-note-flag.html`.

**Repo:** `/home/user/code/tskfrce-v3a`, branch `feat/v3-parent-restyle` (or a `feat/v3-plan-b` branch off it). Backend venv: `/home/user/code/tskfrce-redesign/.venv/bin`.

## Global Constraints

- Files under 500 lines; split before crossing.
- Semantic commits, each ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push.
- Before each commit: `cd backend && ../../tskfrce-redesign/.venv/bin/ruff check app tests && …/python -m pytest -q`; `cd frontend && npx tsc --noEmit && npm run lint && npx jest`. Don't run prettier.
- Parent UI uses `--p-*` tokens, `Chip`, `Icon` (Material Symbols names), `p-btn`; no emojis in parent UI. No neon text on light backgrounds.
- Copy is plain, kid-friendly, sentence case. Error `detail` strings are full sentences.
- Universal notes (in code, every type): **Need help** (`help`) · **Ran out of time** (`schedule`) · **Can't do it today** (`block`).
- Seeded types (name, glyph, notes), positions 0–7, `builtin=1`:
  Cleaning `cleaning_services` (Out of supplies, Did part of it, Too messy for one go) ·
  Schoolwork `school` (Don't understand it, Left it at school, Need the computer) ·
  Pets `pets` (Out of pet food, Pet seems sick, Someone already did it) ·
  Kitchen `restaurant` (Out of supplies, Dishwasher still full, Something broke) ·
  Outdoor `yard` (Bad weather, Too dark, Tool is broken) ·
  Practice `music_note` (Gear is broken, Lesson cancelled) ·
  Personal `self_care` (Don't feel well) · Other `task_alt` (Did part of it).
  Seeded note glyph = its type's glyph (my call; spec gives none).
- Built-in types: renamable (name, glyph, notes editable), not deletable. Deleting a custom type moves its chores to Other.
- Due-soon window: 60 minutes. Missed step deadline = late only (no auto deduction).
- Deductions: parent-only; presets −5/−10/−20/custom; balance never goes below 0 (existing rule kept).
- Plan C owns kid layout/age modes; Plan F owns Apprise. Parent pings here use the existing inbox (`inbox.notify`).

## Decisions taken (owner may override)

1. **Move to tomorrow** only when the chore's assignment does not already occur tomorrow (`can_move`); otherwise the button is hidden and the API answers 409 "It's already on tomorrow's list. Try Skip today." (a run is unique per assignment+day+kid).
2. **Skipped** runs: new status `skipped`; excluded from kid lists, lock counts and streaks (like `cancelled`); parent Today still lists them with a grey "Skipped" chip and **Undo skip** (reuses `/undo`).
3. Note flag on a run (`note_label`, `note_at`) clears when a parent replies in that chore chat, approves, marks done, moves or skips.
4. The **New** chip needs kid "opened" tracking → Plan C. Every other §2.6 chip ships here.
5. "Edit in Settings → Chore types" from the mockup: types are edited in the same side panel opened from the editor's type picker (pencil on the selected type). No separate Settings pane.
6. Reply on a photo = a message carrying that `photo_id` (already supported); reply on a step = new `step_id`.
7. Points rows gain `by_id` (who deducted) so the kid sees "Dad took 10 points".

## Review Focus

1. Editing steps on a chore with ticked runs: renaming/reordering keeps ticks of steps whose title survives (existing `_set_steps` rule) and chain flags follow the step, not the position. → Task 2 test `test_patch_steps_keeps_ticks_and_flags`.
2. Unticking a step whose chained next step is ticked → 409, never an impossible state. → Task 3 `test_untick_blocked_by_chained_next`.
3. A kid note on a chore that is already submitted/done → 409, and a forged label not in the type's notes → 422. → Task 4 `test_note_rules`.
4. Deleting a custom type with chores → chores move to Other, nothing 500s; deleting a built-in → 409. → Task 2 `test_delete_type_rules`.
5. Family time zone ≠ UTC: `due_at` and step `due_at` are computed in the family zone (Overdue at 7:01 PM local, not UTC). → Task 3 `test_due_at_uses_family_tz`.

---

### Task 1: Migration and models

**Files:**
- Create: `backend/alembic/versions/h1a2b3c4d5e6_chore_model_v3.py` (down_revision `g9c0d1e2f3g4`)
- Create: `backend/app/models/chore_type.py`
- Modify: `backend/app/models/chores.py`, `backend/app/models/chat.py`, `backend/app/models/points.py`, `backend/app/models/inbox.py`, `backend/app/models/__init__.py`
- Test: `backend/tests/test_migrations.py` (existing test covers table parity), `backend/tests/test_chore_types.py` (new)

**Interfaces — Produces:**
- `ChoreType(id, name String(40), glyph String(40), builtin Bool, position Int)`, relationship `notes` ordered by position, cascade delete-orphan.
- `ChoreTypeNote(id, type_id FK ondelete CASCADE, label String(40), glyph String(40), position Int)`.
- `Chore.type_id` FK `chore_types.id` NOT NULL (server default = Other's id after seeding; model default via `services.chore_types.other_id(db)` at create), relationship `Chore.type`.
- `ChoreStep.after_previous` Bool NOT NULL default False; `ChoreStep.due_time` String(5) nullable.
- `ChoreRun.status` check adds `'skipped'`; `ChoreRun.note_label` String(40) nullable; `ChoreRun.note_at` DateTime nullable.
- `ThreadMessage.step_id` Int FK `chore_steps.id` ondelete SET NULL nullable; `ThreadMessage.note_label` String(40) nullable.
- `Points.reason` check adds `'deduction'`; `Points.by_id` FK users nullable.
- inbox `KINDS` adds `"chore_note"`.

- [ ] **Step 1:** Write `test_seeded_types` in `tests/test_chore_types.py`: after `alembic upgrade head` on a temp DB (copy the subprocess pattern from `test_migrations.py`), `SELECT name, glyph FROM chore_types ORDER BY position` equals the 8 seeded pairs from Global Constraints, and `SELECT count(*) FROM chore_type_notes` = 19.
- [ ] **Step 2:** Write `test_backfill_type_by_title`: create the DB at `g9c0d1e2f3g4`, insert a user + chores titled "Feed the dog", "Unload dishwasher", "Mystery", upgrade to head, assert types Pets, Kitchen, Other.
- [ ] **Step 3:** Run both → FAIL.
- [ ] **Step 4:** Write the migration. Create tables, seed rows, add columns with `batch_alter_table`, recreate `ck_run_status`, `ck_points_reason`, `ck_notification_kind`. Backfill `chores.type_id` in Python with this map (ported from `frontend/src/v2/today/choreIcon.ts`, first match wins, else Other):
  Kitchen `dish|kitchen|table|cook|lunch|dinner`; Schoolwork `homework|read|study|math|school|book`; Pets `pet|cat|dog|fish|feed`; Practice `piano|music|guitar|violin|practice`; Cleaning `bed\b|make bed|tidy|clean|room|vacuum|sweep|dust|laundry|clothes|wash|trash|garbage|recycl|bin`; Personal `teeth|brush|shower|bath`; Outdoor `yard|garden|plant|water|lawn` (all case-insensitive). Then make `type_id` NOT NULL. Downgrade drops it all.
- [ ] **Step 5:** Add the models and columns listed above. Also make `tests/conftest.py`/factories seed the 8 types for the `create_all` test DB: put the seed data in `app/services/chore_types.py` as `SEED: list[tuple[str, str, list[str]]]` and `def seed(db) -> None` (idempotent; no-op when any type exists); the migration imports nothing from app (copy the literal list) but `seed()` is called from the app startup path that already creates the family row and from conftest.
- [ ] **Step 6:** Run `pytest tests/test_chore_types.py tests/test_migrations.py -q` → PASS; full suite → PASS.
- [ ] **Step 7:** Commit `feat(chores): chore types, step order/deadlines, notes and deductions schema`.

### Task 2: Chore types API and library fields

**Files:**
- Create: `backend/app/api/chore_types.py`, `backend/app/services/chore_types.py` (from Task 1, extend)
- Modify: `backend/app/schemas/chore.py`, `backend/app/api/chore_library.py`, `backend/app/main.py` (include router)
- Test: `backend/tests/test_chore_types.py`, `backend/tests/test_chore_library.py`

**Interfaces — Produces:**
- `UNIVERSAL: list[tuple[str, str]] = [("Need help","help"), ("Ran out of time","schedule"), ("Can't do it today","block")]` in `services/chore_types.py`.
- `def notes_for(t: ChoreType) -> list[dict]` → `[{"label", "glyph", "universal": bool}]`, type notes first then universal.
- `def other_id(db) -> int`.
- Routes (parent only):
  - `GET /api/v1/chore-types` → `[{id, name, glyph, builtin, notes: [{id, label, glyph}], chore_count}]` by position.
  - `POST /api/v1/chore-types` body `{name 1–40, glyph 1–40, notes: [label 1–40] ≤ 8}` → the type; position = max+1; note glyph = type glyph. Duplicate name (case-insensitive) → 409 "There's already a type called X."
  - `PATCH /api/v1/chore-types/{id}` same fields optional; `notes` replaces the list in order.
  - `DELETE /api/v1/chore-types/{id}` → 204; built-in → 409 "Built-in types can't be deleted. Rename it instead."; chores of it move to Other.
- `StepIn {title 1–100, due_time HH:MM|None (use `_hhmm`), after_previous: bool=False}`; `ChoreIn/ChorePatch.steps: list[StepIn]`; `ChoreIn.type_id: int | None` (None → Other), `ChorePatch.type_id`. Unknown type_id → 422 "Pick a chore type from the list.". First step's `after_previous` is forced False.
- `StepOut {id, title, due_time, after_previous}`; `ChoreLibOut` gains `type_id: int`.
- `copy_chore` copies type and step fields.

- [ ] **Step 1:** Tests in `test_chore_types.py`: `test_list_types_with_universal_free` (GET returns 8, Cleaning notes == the 3 seeded labels, universal notes NOT in the type's `notes`), `test_create_rename_reorder_notes`, `test_delete_type_rules` (custom with a chore → 204 and chore.type_id == Other; built-in → 409), `test_kid_cannot_edit_types` (kid token → 403).
- [ ] **Step 2:** Tests in `test_chore_library.py`: `test_create_with_type_and_step_objects` (POST steps `[{"title":"A"},{"title":"B","after_previous":true,"due_time":"16:30"}]` → out steps carry the fields; `{"title":"A","after_previous":true}` as first step comes back False), `test_patch_steps_keeps_ticks_and_flags` (run with step "A" ticked; PATCH steps `[{"title":"B"},{"title":"A","after_previous":true}]` → tick on A survives, A.after_previous True, positions 0/1).
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement. `_set_steps(c, steps: list[dict])` keeps the title-match rule and copies `due_time`/`after_previous` onto kept and new steps.
- [ ] **Step 5:** Run tests → PASS; full suite + ruff → PASS.
- [ ] **Step 6:** Commit `feat(chores): chore types API and step order/deadline fields`.

### Task 3: Ordered steps, deadlines and status inputs

**Files:**
- Modify: `backend/app/services/chores.py`, `backend/app/api/kid.py`, `backend/app/api/family.py`, `backend/app/api/chores.py`, `backend/app/services/progression.py`
- Test: `backend/tests/test_kid_api.py`, `backend/tests/test_today_payload.py`

**Interfaces — Produces:**
- `tick_step(...)` raises `HTTPException(409, "Do the step before this one first.")` when ticking a chained step whose previous step is unticked, and `409 "Untick the step after it first."` when unticking a step whose next step is chained and ticked.
- `steps_out(run, fam)` adds `due_time`, `after_previous`, `due_at` (UTC ISO `…Z` via `economy.deadline_utc(fam, run.day, s.due_time)`, None without due_time), `locked` (chained and previous not done).
- `def due_at(run, fam) -> datetime | None`: the latest of the chore deadline and its step deadlines (spec: chore stays open until the latest step deadline).
- Kid `/kid/today` chores and parent `/family/today` chores (`_chore_out`) and `/chores/{id}` (`run_detail`) gain: `due_at`, `type: {id, name, glyph}`, `sent_back: bool` (`attempt > 1 and status == 'todo'`), steps as above. Kid chores also gain `notes: notes_for(type)`.
- `day_runs(db, day, skipped=False)` excludes `cancelled` and (unless `skipped=True`) `skipped`. Streak query (`progression.chore_days_many`) and `run_reset` treat `skipped` like `cancelled`.

- [ ] **Step 1:** Tests: `test_chained_step_order` (tick B before A → 409 with the copy above; tick A then B → 200), `test_untick_blocked_by_chained_next`, `test_due_at_uses_family_tz` (family tz `America/New_York`, chore due `19:00`, step due `20:30` → kid today `due_at` == that day 20:30 New York in UTC `…T00:30:00Z` next day during EDT), `test_today_has_type_and_notes` (kid chore of Pets type → `notes` labels == 3 Pets notes + 3 universal, in that order).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Pass `fam = get_family(db)` into `steps_out` callers (already loaded in each route).
- [ ] **Step 4:** Run → PASS; `tests/test_query_counts.py` still passes (eager-load `Chore.type` + `ChoreType.notes` in `with_detail`).
- [ ] **Step 5:** Commit `feat(chores): chained steps, step deadlines, due_at and type in payloads`.

### Task 4: Kid notes

**Files:**
- Modify: `backend/app/api/kid.py`, `backend/app/services/chat.py`, `backend/app/api/chat.py`, `backend/app/api/family.py`, `backend/app/api/chores.py`
- Test: `backend/tests/test_kid_notes.py` (new)

**Interfaces — Produces:**
- `POST /api/v1/kid/chores/{run_id}/note` body `{label: str, text: str|None ≤ 200}` (require_kid, so view-as preview is refused like other writes). Run must be `todo` (else 409 "This chore is already with a parent."). `label` must be in `notes_for(type)` labels (else 422 "Pick one of the notes."). Effects: chat message in the chore thread (author kid, `body = text`, `note_label = label`); `run.note_label = label`, `run.note_at = now`; `inbox.notify(db, inbox.parents(db), "chore_note", f"{kid.full_name} left a note on {title}", label + (f' · "{text}"' if text else ''), run_id=run.id)`. Returns `{"ok": true}`.
- `def clear_note(run) -> None` in `services/chores.py`; called from approve, mark done, move, skip, and from `chat.post` when a parent posts in a chore thread.
- Message out (`api/chat.py::_msg`) adds `note_label`.
- Parent payloads (`_chore_out`, `run_detail`) add `note: {label, text, at, kid_name} | None` (text = body of the latest note message).

- [ ] **Step 1:** Tests: `test_note_flags_and_notifies` (kid posts "Out of supplies" + text on a Cleaning run → parent `/family/today` chore has `note.label`; parent inbox has a `chore_note`; thread has a message with `note_label`), `test_parent_reply_clears_note`, `test_note_rules` (submitted run → 409; label "Hack" → 422; universal "Need help" on any type → 200).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, full suite → PASS.
- [ ] **Step 5:** Commit `feat(chores): kid notes flag the chore and ping parents`.

### Task 5: Note actions — Move to tomorrow, Skip today

**Files:**
- Modify: `backend/app/api/chores.py` (split into `api/chore_actions.py` if it passes 300 lines), `backend/app/services/chores.py`
- Test: `backend/tests/test_chore_actions.py` (new)

**Interfaces — Produces:**
- `POST /api/v1/chores/{run_id}/move` (parent): run `todo` only (else 409 "Only a chore that's still to do can move."). If `occurs_on(assignment, tomorrow)` → 409 "It's already on tomorrow's list. Try Skip today." Else `run.day = tomorrow`, clear ticks and note, system message "Moved to tomorrow". Returns `chore_out`.
- `POST /api/v1/chores/{run_id}/skip` (parent): `todo` or `submitted` → `skipped`, clear note, system message "Skipped today (no penalty)". 
- `/undo` also accepts `skipped` → `todo` (system message "Back on today's list").
- Parent payloads add `can_move: bool`; `/family/today` lists skipped runs (`day_runs(..., skipped=True)`) with `state: "skipped"` but kid counts/lock exclude them.
- `svc.state(run)` returns `"skipped"` for skipped runs.

- [ ] **Step 1:** Tests: `test_move_once_chore` (once chore → day+1, kid today no longer lists it, tomorrow's generation keeps it), `test_move_daily_refused` (409 copy above, `can_move` False), `test_skip_keeps_streak_and_unlocks` (kid with 2 chores, approve one, skip the other → lock counts done==total; streak for today counts as done day), `test_undo_skip`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, full suite → PASS.
- [ ] **Step 5:** Commit `feat(chores): move a chore to tomorrow or skip it today`.

### Task 6: Deductions and step replies

**Files:**
- Modify: `backend/app/api/kids.py`, `backend/app/api/chores.py` (or `chore_actions.py`), `backend/app/api/kid.py`, `backend/app/api/chat.py`, `backend/app/services/chat.py`, `backend/app/schemas/` (MessageIn)
- Test: `backend/tests/test_deductions.py` (new), `backend/tests/test_chat.py`

**Interfaces — Produces:**
- `POST /api/v1/kids/{kid_id}/deduct` keeps its shape; rows now `reason="deduction"`, `by_id=parent.id`.
- `POST /api/v1/chores/{run_id}/deduct` body `{kid_id, amount 1–500, note 1–100}`; `kid_id` must be in `run_kid_ids(run)` (else 422 "That kid isn't on this chore."). Row: `reason="deduction"`, `run_id`, `by_id`, `seen_by_kid=False`; system message in the chore thread `"−{n} points: {note}"`. Returns `{"balance", "deducted"}` (same clamp rule).
- Payloads: parent `_chore_out` adds `deducted: int` (sum for that run, positive number); kid chores add `deductions: [{amount, note, by_name, at}]` for that kid and run.
- `MessageIn.step_id: int | None`; valid only in a chore thread and for a step of that run's chore (else 422 "We couldn't find that step."). `_msg` adds `step_id`, `step_title`.

- [ ] **Step 1:** Tests: `test_chore_deduct` (row has reason deduction + run_id + by_id; parent today `deducted == 10`; kid today `deductions[0].by_name` is the parent's name), `test_chore_deduct_wrong_kid` (422), `test_deduct_never_negative` (balance 5, deduct 10 → `deducted == 5`), `test_step_reply` in test_chat.py (message with `step_id` returns `step_title`; foreign step → 422).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, full suite → PASS.
- [ ] **Step 5:** Commit `feat(chores): per-chore deductions and replies on steps`.

### Task 7: Frontend types, hooks and status chip

**Files:**
- Modify: `frontend/src/v2/types.ts`, `frontend/src/v2/hooks/useChores.ts`, `frontend/src/v2/hooks/useToday.ts`, `frontend/src/v2/hooks/useKid.ts`
- Create: `frontend/src/v2/hooks/useChoreTypes.ts`, `frontend/src/v2/today/statusChip.ts`
- Test: `frontend/tests/v2/statusChip.test.ts`

**Interfaces — Produces:**
- Types: `ChoreType {id, name, glyph, builtin, notes: {id, label, glyph}[], chore_count}`; `ChoreNote {label, glyph, universal}`; step `{id, title, done, due_time, due_at, after_previous, locked}`; `TodayChore` adds `due_at, type, sent_back, note, deducted, can_move`, `state` adds `'skipped'`; `KidChore` adds `notes, deductions`.
- Hooks: `useChoreTypes()`, `useSaveChoreType()` (POST/PATCH by `id`), `useDeleteChoreType()`; `useMoveChore()`, `useSkipChore()`, `useDeductChore()` (invalidate `['today']`, `['chore-lib']` as the existing hooks do); kid `useSendNote()`.
- `statusChip(c: {state, due_at, sent_back, note?, deducted?}, now: number): {tone, icon, label}[]` — returns chips in this order: state chip (`done` → acc `check` "Approved"; `needs_you` → lav `hourglass_top` "Needs OK"; `skipped` → grey `do_not_disturb_on` "Skipped"; todo: `sent_back` → red `undo` "Sent back", else past `due_at` → red `alarm` "Overdue", within 60 min → amb `hourglass_bottom` "Due in N min", else grey `schedule` "To do"), then `note` → amb `flag` "Note", then `deducted` → red `remove_circle` "−N".

- [ ] **Step 1:** Test cases: overdue at due_at+1 min; "Due in 20 min" at due_at−20 min; "To do" at due_at−61 min; no due_at → "To do"; sent_back wins over overdue; note + deducted 10 → `['…', 'Note', '−10']` labels.
- [ ] **Step 2:** Run `npx jest statusChip` → FAIL. **Step 3:** Implement. **Step 4:** PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(chores): chore type hooks and status chip rules`.

### Task 8: Chore editor — type picker, New type panel, steps

**Files:**
- Modify: `frontend/src/v2/manage/ChoreDetail.tsx` (split: create `manage/ChoreSteps.tsx` for the Steps card, `manage/ChoreTypePicker.tsx`, `manage/ChoreTypePanel.tsx`), `frontend/src/v2/manage/ChoresList.tsx`, `frontend/src/v2/today/choreIcon.ts`, `frontend/src/v2/parent/parent-manage.css`
- Test: `frontend/tests/v2/choreDetail.test.tsx` (existing), `frontend/tests/v2/choreTypePanel.test.tsx` (new)

Behaviour (mockup 02, Kids & chores → chore editor and New chore type):
- Basics: **Type** row of chips (glyph + name) from `useChoreTypes`, selected = `Chip tone="acc"` look (accent fill, dark text, icon), trailing **+ New type** chip; a pencil button on the selected chip opens the panel in edit mode. Hint "Picks the icon and the notes a kid can send". Header tile icon and `ChoresList` row icons use the chore's type glyph; `ChoresList` groups by `type_id` in type position order (Other last); delete `choreType()` and the TYPE map from `choreIcon.ts` (keep `choreIcon` only for Today rows that lack a type — remove it if nothing else imports it).
- Steps: each row = drag handle (`drag_indicator`; reorder by pointer drag *and* keep the existing ↑/↓ buttons for keyboard), badge (`1`, `2`… for a chain, `–` dashed for free steps), title, **due-time chip** (`schedule` "by 4:30 PM" / "Due time"; click → `<input type="time">`), remove ×. Between two rows a tappable link button toggling the lower step's `after_previous`: `link` "Must be done after the step above" / `link_off` "Any order" (aria-pressed). Legend line under the list. Amber warning (`info`) per step due after the assignment's due time: "“{step}” is due after the chore ({time}). The chore will stay open until {latest}."
- **Notes** card (`sms`): "Notes {kid names} can send", "From the {type} type." and the type notes + universal notes as read-only chips (universal dashed).
- Draft/dirty logic includes `type_id` and step objects.
- **New chore type** side panel (Mantine `Drawer`, right): Name input, icon search input + grid (reuse `parent/GlyphPicker.tsx`), Notes list (add / remove / ↑↓), the three universal notes listed greyed as "Added to every type", **Create type** (edit mode: **Save type**, and **Delete type** for custom types with `ConfirmDelete` "Chores of this type move to Other."). On create, select the new type in the editor.

- [ ] **Step 1:** Tests: `choreDetail.test.tsx` — picking Pets then saving sends `type_id`; toggling the link between step 1 and 2 sends `after_previous: true` for step 2; a step due 20:30 with chore due 18:00 shows the warning text. `choreTypePanel.test.tsx` — create sends `{name, glyph, notes}`; built-in in edit mode has no Delete.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint clean.
- [ ] **Step 5:** Verify in the demo (copy changed files to `/home/user/code/tskfrce-demo/frontend`, log in `admin` / `demo-parent-1` at http://127.0.0.1:3766, screenshot the editor at 1280 and 390 wide next to mockup 02); fix drift.
- [ ] **Step 6:** Commit `feat(manage): chore type picker, type panel, chained steps with deadlines`.

### Task 9: Parent Today — chips, notes, actions, deductions, replies

**Files:**
- Modify: `frontend/src/v2/today/ChoreRow.tsx`, `frontend/src/v2/today/ChoreOpen.tsx` (split out `today/ChoreNote.tsx` and `today/DeductForm.tsx` to stay < 300 lines), `frontend/src/v2/chat/dock.ts`, `frontend/src/v2/chat/ChatDock.tsx`/`ThreadView.tsx` (composer reply state), `frontend/src/v2/chat/ParentBubble.tsx`, `frontend/src/v2/today/PhotoViewer.tsx`, `frontend/src/v2/chat/ThreadSidePanel.tsx`, `frontend/src/v2/parent/parent-today.css`
- Test: `frontend/tests/v2/choreRow.test.tsx`, `frontend/tests/v2/choreOpen.test.tsx` (existing or new)

Behaviour (mockups 01, 03):
- `ChoreRow` renders `statusChip(chore, now)` chips (replace `stateChip`) and the type glyph as its icon.
- Open chore with a note: amber card — type glyph, "{kid}: {label} · “{text}” · {time}", `flag` Note chip; buttons **Reply** (opens chat), **Move to tomorrow** (`event_repeat`, hidden when `!can_move`), **Skip today (no penalty)** (`do_not_disturb_on`). Skip and Move also show on any todo chore in the overflow of actions (secondary). Skipped chore: **Undo skip**.
- **Deduct** button (`remove_circle`, red variant) on open todo/done chores → inline form: kid picker when the run has >1 kid, preset chips −5 / −10 / −20 / Custom, reason input (required), Deduct.
- Steps list: each step shows its due chip (late steps red "Late"), chain badge, and a **Reply** icon button → `openChat('chore', id, { step_id, label: step.title })`. PhotoViewer gets **Reply** → `openChat('chore', id, { photo_id, label: 'Photo' })`.
- `openChat(kind, ref, reply?: { step_id?: number; photo_id?: number; label: string })`; the composer shows a removable "Replying to {label}" bar and sends `step_id`/`photo_id`. Bubbles with `step_title` show a small `subdirectory_arrow_right` quote line; `note_label` messages render as an amber note bubble.
- ThreadSidePanel chore card shows the type and the note.
- Kid detail **Deduct** (`manage/PointsForm.tsx`) gets the same −5 / −10 / −20 / Custom presets.

- [ ] **Step 1:** Tests: overdue row shows "Overdue"; note card renders label/text and hides Move when `can_move` false; Deduct with −10 preset posts `{kid_id, amount: 10, note}`; step Reply calls `openChat` with the step id.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Demo check against mockup 03 (parent half) at 1280 and 390; fix drift.
- [ ] **Step 6:** Commit `feat(today): status chips, kid notes, move/skip, deductions and step replies`.

### Task 10: Kid screen behaviour (current layout)

**Files:**
- Modify: `frontend/src/v2/kid/KidChecklist.tsx` (split out `kid/TellParent.tsx`, `kid/KidSteps.tsx`), `frontend/src/v2/kid/KidPage.tsx`
- Test: `frontend/tests/v2/kidChecklist.test.tsx`

Behaviour (spec §4.2, mockup 03 kid half; fridge look unchanged, Plan C restyles):
- Steps: chained-and-locked step is disabled, greyed, lock icon, text "Unlocks after step N"; step deadline as a small chip "by 4:30 PM" (red "Late" when past `due_at`).
- Chore status chip from `statusChip` (kid wording same labels for now).
- **Tell Mom or Dad** button (`chat_bubble` "Something wrong? Tell a parent") → sheet with big buttons for `chore.notes` (universal ones dashed), optional text (≤200), **Send** → `useSendNote`; afterwards the chore shows "Note sent: {label}" (`check_circle` "Sent to Mom & Dad"). In view-as preview the send shows the existing preview-only message.
- Deduction card per `deductions[]`: "{by_name} took {amount} points" + reason + **Reply** (opens the chore chat).

- [ ] **Step 1:** Tests: locked step checkbox disabled with "Unlocks after step 1"; sheet lists 3 type notes + 3 universal and Send posts `{label, text}`; deduction card text "Dad took 10 points".
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest, tsc, lint.
- [ ] **Step 5:** Commit `feat(kid): tell a parent notes, chained steps, step deadlines, deductions`.

### Task 11: End-to-end and demo pass

**Files:**
- Modify/Create: `frontend/e2e/` lab spec `chore-model.spec.ts` (follow the existing lab specs' login helpers)
- Test: `scripts/lab.sh e2e`

- [ ] **Step 1:** Spec: parent creates a custom type "Garage" with note "Too cold", makes a chore of it with two chained steps; kid logs in, can't tick step 2 first, sends "Too cold" note; parent sees the Note chip and Skip today; skip → kid's lock count satisfied; parent deducts −5 on another chore; kid sees the deduction card.
- [ ] **Step 2:** `scripts/lab.sh e2e` → all pass (was 40 passed, 5 skipped).
- [ ] **Step 3:** Run the demo migration (`alembic upgrade head` with the demo `DATA_DIR`), copy frontend files to the demo checkout, click through every new surface light/dark/phone; axe 0 serious/critical.
- [ ] **Step 4:** Commit `test(e2e): chore model flow`.
