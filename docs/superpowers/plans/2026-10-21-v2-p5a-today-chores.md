# v2 Project 5a: Today + Kids & chores overhaul, chore features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-kid chores (Each / Race / Team), subtasks, required photo proof, send-back with a note, chore editing/copying; a parent Today with a typed "Needs you" headline and one tab per kid; a sidebar-organized Kids & chores; kid-side subtasks, photo upload and send-back notes.

**Architecture:** Chore definitions keep config in `recurrence_pattern` (now `assignees`, `mode`, `subtasks`). Instances: Each → one per kid (existing path); Race/Team → one shared instance with participants in a junction table. One query helper (`kid_chores_filter`) replaces every "this kid's chores" filter so locks, kid screens and parent views agree. Photos are re-encoded server-side (strips EXIF) and served only through authenticated routes. Parent Today gets one aggregated endpoint shape; the frontend is rebuilt around it.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, SQLite, Pillow (new), pytest; Next.js + Mantine + TanStack Query + `@tabler/icons-react`, Jest.

**Spec:** `docs/superpowers/specs/2026-10-21-v2-today-chores-chat-design.md` (Part 5a + "Data model"). Mockups: `docs/superpowers/specs/2026-10-21-v2-teen-redesign-mockups/kids-chores.html`, `today-tabs.html`, `needs-types.html`, `today-dense.html` (lightbox).

Prerequisite: Project 2 merged into `feat/v2-teen-redesign` (uses `economy.award_chore`, `due_time`, redemptions). Commands as in the Project 2 plan. Mockup files to copy into the repo first (Task 1, Step 0): from `/home/user/code/tskfrce-blocker/.superpowers/brainstorm/3658153-1792603322/content/` copy `kids-chores.html`, `today-tabs.html`, `today-dense.html`, `needs-types.html` into `docs/superpowers/specs/2026-10-21-v2-teen-redesign-mockups/`.

## Global Constraints

- Modes: `each` (own instance + own points), `race` (one shared instance; points to the kid who submitted the approved attempt; closes for all), `team` (one shared instance; any participant ticks/submits; points split evenly `points // n` to each participant, remainder dropped). One assignee ⇒ `each` (shown as "Solo").
- Race send-back reopens it for all participants (status back to to-do, `submitted_by_id` cleared).
- Lock gating (`chore_counts`): a shared instance counts for **every** participant; it counts approved for all once approved (so a won race doesn't keep siblings offline).
- Subtasks: kid can't submit until all are ticked — UI disables, server returns 409 "Tick every step first."
- Photo proof: with `needs_photo`, submit requires ≥ 1 photo with `attempt == task.attempt` — server 409 "Add a photo first." Accept `image/jpeg`, `image/png`, `image/webp`, ≤ `settings.MAX_UPLOAD_SIZE` (10 MB); re-encode with Pillow to JPEG (quality 85, longest side ≤ 2000 px) — this drops EXIF/location; thumbnail longest side 320 px. Stored under `settings.DATA_DIR / "chore_photos"`. Served only via `GET /api/v1/chore-photos/{id}` and `/thumb` to an authenticated parent or a participant kid; never static/public.
- Send back: parent only, note required (1–500 chars, 422 otherwise); status → `TODO`; `attempt += 1`; `last_note = note`; subtask ticks kept; photos kept. Resubmission time (`submitted_for_approval_at`) is what bonus/streak use.
- Edit (`PATCH /chores/{definition_id}`): updates the definition; also updates today's instances that are still `TODO`/`IN_PROGRESS` (title, points, due_time, needs_photo, subtasks list rebuilt keeping ticks for unchanged titles). Submitted/approved/cancelled instances untouched. Changing assignees/mode applies from the next reset (Claude's call: avoids moving in-flight work).
- Copy is frontend-only: editor opens prefilled, title `"<title> (copy)"`, saves via create.
- Needs you item types and look: Chore (Tabler `IconChecklist`, green), Redo (`IconRefresh`, coral, label "2nd try"/"3rd try" from `attempt`), Screen time (`IconHourglass`, periwinkle `#5b6fb5`), Reward (`IconGift`, sun). Chips show icon + uppercase label; items have a 4px colored left edge.
- Copy tone: plain, friendly, a next step. Touch targets ≥ 44 px. Light + dark. Files < 500 lines.

## Review Focus

1. **Shared chore and locks:** Leo and Maya share a Race chore; Maya's attempt is approved → Leo's devices aren't held offline by it. (Task 1 test.)
2. **Team points:** 25 points, 2 kids → 12 each, approve twice → still one award set. (Task 1 test.)
3. **Photo privacy:** another family member who isn't a participant kid → 404 on the photo; unauthenticated → 401; stored file has no EXIF. (Task 2 test.)
4. **Submit bypass:** crafted `POST /kid/chores/{id}/done` with unticked subtasks or no current-attempt photo → 409. (Task 2 test.)
5. **Today with many kids/items:** 4 kids × 8 chores, 12 Needs-you items → page height bounded: Needs you scrolls horizontally, only the selected kid's tab renders its list. (Task 4 test: only one tab panel's chore rows in the DOM.)

---

### Task 1: Multi-kid chores — assignees, modes, shared instances, edit

**Files:**
- Create: `backend/alembic/versions/c3d4e5f6a7b9_chore_sharing.py` (revises Project 2's last; adds `chore_participants(task_id FK tasks, kid_id FK users, PK both)`, `tasks.submitted_by_id FK users NULL`, `tasks.attempt INTEGER NOT NULL DEFAULT 1`, `tasks.last_note VARCHAR(500) NULL`)
- Modify: `backend/app/models/task.py` (three columns + `participants` relationship via `chore_participants`)
- Modify: `backend/app/lock/reset.py` (`make_instances`, `kid_chores_filter`, `chore_counts`)
- Modify: `backend/app/api/chores.py` (create with `kid_ids` + `mode`; `PATCH /chores/{definition_id}`; definitions list/filter; approve semantics per mode)
- Modify: `backend/app/api/kid.py`, `backend/app/api/kids.py`, `backend/app/lock/state.py` call sites → `kid_chores_filter`
- Modify: `backend/app/services/economy.py` (`award_chore` handles race winner and team split)
- Modify: `backend/app/schemas/chore.py`
- Test: `backend/tests/test_chore_sharing.py`

**Interfaces:**
- `make_instances(defn: Task, day: date) -> list[Task]` replaces `make_instance` (keep `make_instance` as a thin wrapper only if other code imports it). Each → one per assignee with `assigned_to_id`; race/team → one with `assigned_to_id=None` and `participants` = assignees. Assignees = `pattern.get("assignees") or [defn.assigned_to_id]`.
- `kid_chores_filter(kid_id: int)` → SQLAlchemy clause `or_(Task.assigned_to_id == kid_id, Task.id.in_(select(chore_participants.c.task_id).where(chore_participants.c.kid_id == kid_id)))`.
- `ChoreCreate`: `kid_ids: list[int]` (min 1; `kid_id` still accepted and mapped to `[kid_id]` for the setup wizard), `mode: Literal["each","race","team"] = "each"`, `subtasks: list[str] = []` (each 1–100 chars, max 20). `ChoreOut` adds `kid_ids`, `mode`, `subtasks: [{id, title, done}]` (instances) or `[str]` (definitions), `attempt`, `last_note`, `submitted_by_id`.
- `ChorePatch`: all `ChoreCreate` fields optional.
- `kid.py` done route sets `submitted_by_id = kid.id`.

- [ ] **Step 0:** copy mockups (see Prerequisite).
- [ ] **Step 1: Failing tests:** create `kid_ids=[a,b], mode="each"` → reset makes 2 instances; `race` → 1 instance, both kids see it in `/kid/today`; race approve → points only to submitter, instance closed for the other, **other kid's `chore_counts` shows it approved**; race send-back (Task 2 adds the route — here assert via direct status reset) reopens; `team` 25 pts × 2 → 12 + 12, **approve twice → 409 and no extra rows**; legacy single-kid definitions still produce one instance; PATCH title/points updates today's TODO instance but not a submitted one; PATCH assignees affects only the next reset.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** migration, model, helpers, routes, economy changes; switch every chore filter listed above to `kid_chores_filter`.
- [ ] **Step 4: Run backend suite + ruff + `test_migrations.py`, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): shared chores with each, race and team modes`

---

### Task 2: Subtasks, photo proof, send back

**Files:**
- Modify: `backend/requirements.txt` (`Pillow==11.0.0` or newest 11.x)
- Create: `backend/alembic/versions/d4e5f6a7b8ca_subtasks_photos.py` (`chore_subtasks(id, task_id FK, position, title VARCHAR(100), done_by_id FK users NULL, done_at NULL)`, `chore_photos(id, task_id FK, attempt, uploaded_by_id FK, path, thumb_path, created_at)`)
- Create: `backend/app/models/chore_extra.py` (`ChoreSubtask`, `ChorePhoto`)
- Create: `backend/app/services/photos.py` (`save_photo(upload: UploadFile, task: Task, user: User) -> ChorePhoto`)
- Create: `backend/app/api/chore_photos.py` (`GET /api/v1/chore-photos/{id}` and `/{id}/thumb`, `FileResponse`)
- Modify: `backend/app/lock/reset.py` (`make_instances` creates subtask rows from `pattern["subtasks"]`)
- Modify: `backend/app/api/kid.py` (`POST /kid/chores/{id}/subtasks/{sub_id}` body `{done: bool}`; `POST /kid/chores/{id}/photos` multipart `file`; done route validates subtasks + photo)
- Modify: `backend/app/api/chores.py` (`POST /chores/{id}/send-back` body `{note}`; parent `POST /chores/{id}/photos` too, for completeness of threads later — optional, skip if it adds > 20 lines)
- Test: `backend/tests/test_chore_proof.py`

**Interfaces:**
- Kid may tick/upload only on instances they participate in and only while `TODO`/`IN_PROGRESS` (409 "This chore is already with a parent.").
- Photo access: parent of the family, or a kid in `kid_chores_filter` for that task; else 404.
- Send-back response = updated `ChoreOut`.

- [ ] **Step 1: Failing tests:** subtasks copied to instance in order; tick/untick; **done with an unticked step → 409 "Tick every step first."**; needs_photo without photo → 409 "Add a photo first."; upload jpeg with GPS EXIF → stored file opens with Pillow and has no EXIF; > 10 MB → 413; `text/plain` → 415; **non-participant kid → 404 on photo, no token → 401**; send-back without note → 422; send-back → status todo, attempt 2, `last_note` set, photo from attempt 1 no longer satisfies needs_photo, ticks kept; race send-back clears `submitted_by_id`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run backend suite + ruff, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): subtasks, photo proof and send back`

---

### Task 3: Today payload for the new parent screen

**Files:**
- Modify: `backend/app/api/family.py` (`GET /today`)
- Test: `backend/tests/test_today_payload.py`

**Interfaces:** `GET /api/v1/today` keeps existing keys and adds:
- `needs_you: [{type: "chore"|"redo"|"screen_time"|"reward", id, kid_id, kid_name, title, attempt?, thumb_url?, subtasks_done?, subtasks_total?, submitted_at?, cost?, kid_balance?, mode?}]` — chores in `SUBMITTED_FOR_APPROVAL` (`type` = `"redo"` when `attempt > 1`) plus pending redemptions from Project 2; oldest first.
- per kid in `kids[]`: `done`, `total`, `needs_you_count`, `last_active` (max device `last_seen`, ISO Z or null), and each chore `{id, title, points, state, due_time, mode, subtasks_done, subtasks_total, attempt, last_note, taken_by?}` (`taken_by` = winner name for a closed race).
- `thumb_url` = `/chore-photos/{id}/thumb` (frontend prefixes the API base).

- [ ] **Step 1: Failing tests:** needs_you mixes a submitted chore, a redo (attempt 2) and a pending screen-time request, ordered oldest first; per-kid counts; `last_active` = latest device; shared race appears under both kids; a closed race shows `taken_by`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with a bounded number of queries (no per-chore queries in loops beyond what exists).
- [ ] **Step 4: Run backend suite + ruff, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): today payload with needs-you feed`

---

### Task 4: Parent Today — Needs you + kid tabs

**Files:**
- Create: `frontend/src/v2/today/NeedsYou.tsx` (strip, type filter chips with counts, Approve all, items per type; replaces Project 2's `RequestsPanel` — delete it and its mount)
- Create: `frontend/src/v2/today/PhotoViewer.tsx` (Mantine `Modal` full-screen on phones; image from the photo URL with auth header via a blob URL; Approve / Send back; Send back needs a non-empty note)
- Create: `frontend/src/v2/today/KidTabs.tsx` (Mantine `Tabs`; label `name done/total` + red dot when `needs_you_count > 0`; remembers last tab in `localStorage` wrapped in try/catch)
- Rewrite: `frontend/src/v2/today/KidCard.tsx` → kid tab panel: header (name, points, done today, online/last active), **Still to do** (all remaining, due pill, mode tag, `1/3` subtasks, points), **Done** collapsed (`<details>`), side column **Devices** (existing `DevicePill` / `DeviceQuickMenu`). Level/XP/streak, chat and Recent boxes are **not** rendered yet (Projects 3/5b).
- Modify: `frontend/src/v2/today/TodayPage.tsx`, `frontend/src/v2/types.ts`, `frontend/src/v2/hooks/useToday.ts` (approve / send-back / decide mutations invalidate `['today']`)
- Remove if unused after rewrite: `ChipRow.tsx`, `ChoreChip.tsx` (and their tests' imports)
- Test: rewrite `frontend/tests/v2/today.test.tsx`

- [ ] **Step 1: Failing tests:** Needs you renders one item per type with its chip label and the right Tabler icon test id; filter chip "Screen time 1" shows only that item; Approve on a chore posts `/chores/{id}/approve`; Send back without note keeps the button disabled, with note posts `/chores/{id}/send-back {note}`; Redo shows "2nd try"; tapping a thumbnail opens the viewer; kid tabs show `3/7` and a dot; **only the selected tab's chore rows are in the DOM**; Done is collapsed by default; Approve all approves every visible item.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** to the mockups (`today-tabs.html`, `needs-types.html`, `today-dense.html` lightbox) with Project 1 classes.
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): needs-you headline and kid tabs on today`

---

### Task 5: Kids & chores — sidebar, chore list, chore editor, kids

**Files:**
- Create: `frontend/src/v2/manage/ManageLayout.tsx` (sidebar: Chores, Kids, Rewards, Badges* + per-kid jump list with `done/total`; top `SegmentedControl`/menu under 768 px). *Badges entry hidden until Project 3 provides a section.
- Create: `frontend/src/v2/manage/ChoresSection.tsx` (progress strip per kid; filter chips Everyone / each kid / Shared; rows per `kids-chores.html`)
- Rewrite: `frontend/src/v2/manage/ChoreEditor.tsx` → side panel (Mantine `Drawer` position right, full screen < 768 px): title, points, due by, repeat, Assign to (multi `Chip.Group`), mode `SegmentedControl` with the one-line explanation per mode, subtasks (add/remove/reorder via up/down buttons — no drag library), needs photo; header Copy / Delete; Save / Cancel. Create and edit share it.
- Create: `frontend/src/v2/manage/KidsSection.tsx` (list + `KidEditor` in the same drawer pattern + "Add a kid")
- Create: `frontend/src/v2/manage/RewardsSection.tsx` (mounts Project 2's `RewardsPanel`)
- Modify: `frontend/src/v2/manage/KidsPage.tsx` (route section via `?section=chores|kids|rewards`, default chores), `frontend/src/v2/hooks/useChores.ts` (`useCreateChore` sends `kid_ids`, `mode`, `subtasks`; new `usePatchChore`)
- Remove if unused: `ChoreList.tsx`
- Modify: setup wizard callers of chore create if the payload type changed (keep `kid_id` path working)
- Test: rewrite chore/kid parts of `frontend/tests/v2/manage.test.tsx`; new `frontend/tests/v2/choreEditor.test.tsx`

- [ ] **Step 1: Failing tests:** sidebar switches sections via `?section=`; filter "Shared" shows only multi-kid chores; editor create sends `{title, points, kid_ids:[1,2], mode:"race", subtasks:["Fold clothes","Make bed"], repeat, due_time, needs_photo}`; mode explanation text changes per mode; subtask reorder changes order sent; Copy opens editor with "(copy)" title and saving POSTs (not PATCH); edit PATCHes `/chores/{definition_id}`; Delete still uses `ConfirmDelete`; Kids section edits a kid through `KidEditor`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** to `kids-chores.html`.
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): sidebar kids and chores with full chore editor`

---

### Task 6: Kid side — subtasks, photo upload, notes, shared states

**Files:**
- Modify: `frontend/src/v2/kid/KidChecklist.tsx` (each chore expands to its subtasks with checkboxes; "Add photo" uses `<input type="file" accept="image/*" capture="environment">`, uploads, shows thumbnails; "Done" disabled until steps ticked and, if needed, a current-attempt photo exists; sent-back chores show the parent note in a coral callout "Sent back: <note>"; race taken by a sibling shows "Taken by <name>" and no actions; team shows "Team" tag)
- Modify: `frontend/src/v2/hooks/useKid.ts` (`useTickSubtask`, `useUploadPhoto` — multipart, kid token; invalidate `['kid-today']`)
- Modify: `backend/app/api/kid.py` `today` if any field the kid UI needs is missing (`subtasks`, `needs_photo`, `photo_count_current`, `last_note`, `mode`, `taken_by`)
- Test: `frontend/tests/v2/kid.test.tsx` additions

- [ ] **Step 1: Failing tests:** Done disabled with an unticked step, enabled after ticking all; needs-photo chore keeps Done disabled until an upload resolves; upload posts `FormData` with `file`; sent-back chore shows its note; taken race shows "Taken by Maya" without a Done button.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run jest + type-check + lint and backend suite if kid.py changed, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): kid subtasks, photo proof and send-back notes`
