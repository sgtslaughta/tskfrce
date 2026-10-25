# v3 Plan C — Kid app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the kid app in three age modes (Little, Kid, Teen) on phone, tablet and desktop. Add kid alerts (an in-app Alerts page plus ntfy push from the box) and the parent's controls: age group and the kid-phone QR code.

**Architecture:** Backend: one migration, then the new code. `services/kid_view.py` builds the kid payload (moved out of `api/kid.py`, which is at 400 lines). `services/kid_events.py` holds the event-driven kid notifications. `services/kid_alerts.py` is a time-based scanner run from the existing lock loop. `services/push.py` sends ntfy messages after the DB commit. `api/kid_push.py` serves the parent QR endpoints. Frontend: a new `KidApp` shell (rail ≥ 768px, bottom bar below) hosts one of three mode components, chosen by `age_group` from `/kid/today`. Shared chore pieces (chips, steps, Tell Mom or Dad sheet, deduction cards) live in `frontend/src/v2/kid/`. `KidChecklist`/`UnlockedView` and the 520px cap are removed.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (SQLite, `batch_alter_table`), pytest, httpx, segno (new, QR SVG); Next.js pages router, React Query, Mantine, jest, Playwright; ntfy (`binwiederhier/ntfy`) as a compose service.

**Spec:** `docs/superpowers/specs/2026-10-24-v3-redesign-design.md` §4 (all), §6.2, §2.4–2.6, §9 (kid `age_group`). Mockups `docs/superpowers/specs/2026-10-24-v3-redesign-mockups/08-kid-phone.html`, `09-kid-little.html`, `10-kid-kid.html`, `11-kid-teen.html`, `12-kid-age-switcher.html` (serve the folder with `python3 -m http.server` to use 12).

**Repo:** `/home/user/code/tskfrce-v3a`, branch `feat/v3-parent-restyle`. Do not switch branches. Backend venv: `/home/user/code/tskfrce-redesign/.venv/bin`. A live demo (http://127.0.0.1:3766, `admin` / `demo-parent-1`) runs from this checkout with `--reload`. **Never start, stop or restart its servers.** After Task 1, ask the controller to upgrade the demo DB.

**Already built by Plan B (consume, don't rebuild):** `/kid/today` returns `timezone` and per-chore `note`, `notes`, `deductions`, `subtasks` (with `done_at`, `due_at`, `after_previous`, `locked`), `due_at`, `type`, `sent_back`. Other Plan B pieces: `POST /kid/chores/{id}/note`, `KidSteps.tsx`, `TellParent.tsx`, `useSendNote`, `statusChip` (parent wording), and kid chat with edit/delete/reactions (`ChatDock kid`).

## Global Constraints

- Files under 500 lines (aim < 300 for components); split before crossing.
- Semantic commits; every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push. Stage only the task's files.
- Before each commit, run the checks for each side you touched:
  - Backend: `cd backend && /home/user/code/tskfrce-redesign/.venv/bin/ruff format --check . && /home/user/code/tskfrce-redesign/.venv/bin/ruff check . && /home/user/code/tskfrce-redesign/.venv/bin/python -m pytest -q`.
  - Frontend: `cd frontend && npx tsc --noEmit && npm run lint && npx jest`.
  - **Never run prettier.** `ruff format` (no `--check`) is allowed to fix backend formatting.
- Kid look = fridge: Space Grotesk display, Inter body, navy ink `#1d2b53`, sun/green/coral/amber fills. Don't change the `--f-*` tokens. The new kid-mode tokens are `--k-*`, scoped to `.k-app` (values in Task 8).
- Never white text on coral; navy `#1d2b53` on coral, amber, green and sun (§2.4).
- Icons: Material Symbols via `@/v2/parent/Icon` (`<Icon name="…" fill? size? />`). Remove every `@tabler/icons-react` import under `frontend/src/v2/kid/`. The kid's avatar emoji and built-in badge emojis stay.
- Copy, verbatim from the spec and mockups:
  - Little: "Hi {name}!", "No games yet", "Do this now", "I did it!", "Next".
  - Little nav: "Chores", "Prizes", "Me".
  - Kid/Teen nav: "Chores", "Rewards", "Chat", "Alerts", "Me".
  - Kid mode: "Internet is paused", "Finish {n} more chores to turn it on", "All chores", "I'm done!", "Tell Mom/Dad", "Chat", "Finish all the steps to press “I'm done!”".
  - Teen: "Internet paused", "done today", "points", "streak", "All · n" / "To do · n" / "Waiting · n" / "Done · n", "Steps · in order 1 → 3", "Latest", "Mark done", "Mark done · finish steps first".
  - Shared: "Tell Mom or Dad", "About: {title}", "Send", "Note sent: {label}", "{by} took {n} points", "Reply".
  - Preview bar: "Viewing as {name} · preview", "Back to parent". Preview writes: "Preview only. Log in as {name} to do this."
- Status chips (§2.6), kid wording, in this priority order. Normal wording / Little wording, tone, icon:
  - Sent back / Sent back: `back`, `undo`
  - Overdue / "Late!": `late`, `alarm`
  - "Due in N min" / "Hurry · N min": `soon`, `hourglass_bottom` (due within 60 min)
  - New / New: `new`, `fiber_new`
  - "Due 7:30" / "By 7:30": `today`, `schedule`
  - Waiting for OK: `wait`, `hourglass_top`
  - Approved / "Done": `done`, `check`
- Age groups: `little` (Little 5–8), `kid` (Kid 9–12, default), `teen` (Teen 13+).
- Kid alert kinds (the only kinds a kid ever gets, in-app or push): `chore_new`, `due_soon`, `missed_deadline`, `chore_approved`, `chore_sent_back`, `points_taken`, `lock_warning`, `chat_message`, `redemption_decided`, `badge_earned`, `level_up`.
- Alert timing: "due soon" fires from 30 min before a chore or step deadline. The lock warning looks 10 min ahead. A missed step deadline means late only: no deduction.
- Push stays in the house: the backend posts only to the box's own ntfy service. No ntfy.sh upstream and no other cloud service.

## Decisions taken (owner may override)

1. **Breakpoints.**
   - Phone (< 768px): a bottom bar with the mode's nav items.
   - ≥ 768px: a left rail (Kid 132px, Teen 76px). Little keeps its 3-button bottom nav at every width, as in 09.
   - Teen's detail panel sits on the right at ≥ 1100px. Narrower, picking a row replaces the list with the detail plus "← All chores".
   - Little's "Next" queue is a right column at ≥ 900px; below that it stacks under "Do this now".
   - Content max-width 1280px, centred. The parent preview uses the same full-width shell.
2. **Phone (08)** = each mode's own layout, stacked, with the bottom bar. Mockup 08 sets the look of steps, deductions, the sheet and the preview bar; its v2 hero list is not a separate fourth layout.
3. **One `--k-*` token set** for all modes, taken from mockup 10 (Teen's slightly different dark bg `#121828` is not used).
4. **Tiles show at most two chips:** points, plus the highest-priority status chip from the priority order in Global Constraints. The mockup's third chip on "Water plants" is dropped (spec says "at most two").
5. **New** = the assignment was created in the last 24h and this kid hasn't opened it. "Opened" means:
   - Kid mode: the tile was opened.
   - Teen: the row was selected.
   - Little: it was shown as "Do this now".

   Tracked per kid per assignment (`chore_seen`).
6. **Lock warning:** sent when the kid is online now and would be locked within 10 min. This covers allowed hours ending, a free window ending and an unlock/bonus expiring. It is sent even when all chores are done. The body names the chores left when there are any.
7. **Unlocked states** (the owner's fix: chores and deductions stay visible in every mode):
   - Little pill: green `wifi` "Games on!".
   - Kid banner: green `wifi` "Internet is on" with "{n} chores left today" or "All done for today. Nice work!".
   - Teen strip: "Internet on" with "locks at {time}" or "All done".
8. **Little mode** has no chat and no Alerts page (spec), so its deduction card has no Reply button. Push still works.
9. **Chat nav** opens the existing kid `ChatDock` on its thread list. The dock's floating launcher is hidden when the nav has a Chat item.
10. **Preview**: parent preview never calls `/seen` and never polls kid-token endpoints (`/inbox`, threads). The Alerts and Chat tabs show "Alerts and chat show on {name}'s own screen."
11. **ntfy service.**
    - Prod compose only. Host port `${NTFY_PORT:-0.0.0.0:2586}` maps to container 80.
    - Phones subscribe at `NTFY_PUBLIC_URL`, defaulting to the host of `BOX_URL` on port 2586 over http.
    - Topics are 24-char secrets, rotatable from Settings. The server has no auth: knowing the topic is the key.
12. **QR code**: rendered by the backend (segno) and returned as SVG text in the JSON. `<img>` can't send the bearer token.
13. **Blocker**: no rule change needed. Locked devices already reach LAN and docker-bridge addresses (`172.16.0.0/12` is in `DEFAULT_LAN_CIDRS`), and prerouting only redirects ports 53/80. Task 6 pins this with a test.
14. **Parent chat reply alerts** go out for chore threads and the kid's private thread only. Family-thread messages don't alert.

## Review Focus

1. **Parent "View as kid" at full width.** It renders the kid's age mode, never writes, and any write toasts "Preview only. Log in as {name} to do this." → Task 12 `kidApp.test.tsx` "preview: …".
2. **Unlocked kid (all approved, or in free time) still sees chores, deductions and notes** in every mode. This was the v2 bug the owner flagged. → Task 9 `kidMode.test.tsx` "unlocked shows tiles and deduction", Task 10 and Task 11 equivalents.
3. **ntfy down or slow never fails or delays the request.** A rolled-back transaction pushes nothing, and a parent-only kind never pushes to a kid. → Task 5 `test_push.py`.
4. **Scanner idempotence.** Running the scan twice gives one alert. If the box was off through a deadline, it sends "late" only, no stale "due in". Skipped or submitted runs never alert. → Task 4 `test_kid_alerts.py`.
5. **Family time zone ≠ browser zone.** Chip times ("Due 7:30", "by 5:00 PM") use `KidToday.timezone`, not the device clock. Edge cases: zero chores, and all chores waiting. → Task 7 `kidChips.test.ts`, Task 11 "nothing to do".

---

### Task 1: Migration and models

**Files:**
- Create: `backend/alembic/versions/l5e6f7a8b9c0_kid_app_v3.py` (down_revision `k4d5e6f7a8b9`)
- Modify: `backend/app/models/user.py`, `backend/app/models/chores.py`, `backend/app/models/inbox.py`, `backend/app/models/__init__.py`, `backend/app/services/inbox.py`
- Test: `backend/tests/test_migrations.py` (existing parity test), `backend/tests/test_inbox.py`

**Interfaces — Produces:**
- `User.age_group = Column(String(6), nullable=False, default="kid", server_default="kid")`, check `ck_user_age_group`: `age_group IN ('little','kid','teen')`.
- `User.push_topic = Column(String(40), nullable=True, unique=True)` (constraint name `uq_user_push_topic`).
- `ChoreSeen` in `models/chores.py`:
  - `__tablename__ = "chore_seen"`
  - `assignment_id` FK `chore_assignments.id` ondelete CASCADE, PK
  - `kid_id` FK `users.id` ondelete CASCADE, PK
  - `seen_at` DateTime NOT NULL default `datetime.utcnow`
- `Notification.dedup_key = Column(String(60), nullable=True)` + `UniqueConstraint("user_id", "dedup_key", name="uq_notification_dedup")`.
- `inbox.KINDS` adds `"chore_new", "due_soon", "missed_deadline", "chore_approved", "chore_sent_back", "points_taken", "lock_warning"`.
- `services/inbox.py`:
  - `KID_KINDS: frozenset[str]` = the kid alert kinds in Global Constraints.
  - `notify(..., dedup_key: str | None = None) -> int` returns the number of rows added. With `dedup_key`, a recipient that already has a row with that key is skipped.

- [ ] **Step 1:** Write `test_notify_dedup` in `tests/test_inbox.py`.
  - Call `inbox.notify(db, [kid.id], "due_soon", "x", dedup_key="soon:r1")` twice, committing after each.
  - Assert the returns are 1 then 0, and there is exactly one row.
- [ ] **Step 2:** Run `…/python -m pytest tests/test_inbox.py tests/test_migrations.py -q`. Expected: FAIL (unknown kind / no column).
- [ ] **Step 3:** Write the migration.
  - Use `batch_alter_table` for `users` (two columns, check, unique) and for `notifications` (column + unique). Recreate `ck_notification_kind` with the 7 new kinds, copying the `_in`/`KINDS` pattern from `h1a2b3c4d5e6_chore_model_v3.py`.
  - Create `chore_seen`.
  - Downgrade: delete notifications of the new kinds, then drop everything in reverse.
- [ ] **Step 4:** Add the models and the `notify` change.
- [ ] **Step 5:** Run the tests from Step 2 → PASS; full backend checks → PASS.
- [ ] **Step 6:** Commit `feat(kid): age group, push topic, seen tracking and alert kinds schema`.

### Task 2: Kid payload — age group, New, done time, locks-at, seen

**Files:**
- Create: `backend/app/services/kid_view.py`
- Modify: `backend/app/api/kid.py` (move `_names`, `_kid_extras`, `_mine` out), `backend/app/api/kids.py`, `backend/app/schemas/lock.py` (`KidCreate`, `KidPatch`)
- Test: `backend/tests/test_kid_view.py` (new), `backend/tests/test_parent_api.py`

**Interfaces — Produces:**
- `kid_view.names(db, ids) -> dict[int, User]`
- `kid_view.mine(deds, kid_id) -> list[dict]`
- `kid_view.extras(run, fam, takers, deds, texts, seen: set[int], now: datetime) -> dict`: the old `_kid_extras` fields plus:
  - `"new": bool`: `run.assignment.created_at >= now_naive_utc - 24h` and `run.assignment_id not in seen`.
  - `"done_at"`: `iso_z(run.submitted_at or run.approved_at)`, else None.
- `kid_view.seen_ids(db, kid_id, assignment_ids) -> set[int]`.
- `kid_view.locks_at(db, kid, fam, now_utc) -> str | None`: `window_end` over the kid's own `TimeWindow` rows with `kind == "allowed"`, as UTC `…Z`. Same rule as `api/family.py::_locks_at`.
- `GET /api/v1/kid/today` adds top-level `age_group` and `locks_at`; each chore gains `new` and `done_at`.
- `POST /api/v1/kid/chores/{run_id}/seen` (`require_kid`) → 204.
  - Idempotent insert of `ChoreSeen(run.assignment_id, kid.id)`.
  - A run outside `svc.kid_runs_filter(kid.id)` → 404 "We couldn't find that chore."
- Kids API:
  - `_out` adds `age_group`.
  - `KidCreate.age_group` and `KidPatch.age_group` are `Literal["little","kid","teen"] | None` (create: None → "kid").

- [ ] **Step 1:** Write the tests in `test_kid_view.py`:
  - `test_today_has_age_group_and_locks_at`: kid `age_group="teen"`; allowed window 00:00–21:00 every day → `age_group == "teen"` and `locks_at` ends `21:00` local (family tz UTC in the test).
  - `test_new_until_seen`: fresh assignment → `new` True; POST `/seen` → 204; `/kid/today` → `new` False; POST again → 204.
  - `test_old_assignment_not_new`: `created_at` 25h ago → `new` False.
  - `test_seen_other_kids_run_404`.
  - `test_done_at_after_submit`.
  - In `test_parent_api.py`, `test_kid_age_group_patch`: PATCH `{"age_group": "little"}` → `_out` has it; `{"age_group": "baby"}` → 422.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Move the helpers verbatim first, then add the fields. `today()` calls `kid_view.seen_ids` once for all runs.
- [ ] **Step 4:** Run → PASS; `tests/test_query_counts.py` still passes; full backend checks.
- [ ] **Step 5:** Commit `feat(kid): age group, new chip, done time and locks-at in the kid payload`.

### Task 3: Event-driven kid alerts

**Files:**
- Create: `backend/app/services/kid_events.py`
- Modify: `backend/app/api/chores.py` (approve, parent done, send-back), `backend/app/services/economy.py` (`deduct`), `backend/app/api/chore_library.py` (every place that creates a `ChoreAssignment`; grep `ChoreAssignment(`), `backend/app/services/chat.py` (`post`)
- Test: `backend/tests/test_kid_events.py` (new)

**Interfaces — Produces** (all write via `inbox.notify` to kid ids only, no commit):
- `chore_decided(db, run, approved: bool, note: str | None = None) -> None`. Recipients: `svc.run_kid_ids(run)`.
  - Approved: `chore_approved`, title `f"{title} approved"`, body `f"+{points} points"`.
  - Else: `chore_sent_back`, title `f"{title} was sent back"`, body `note or "Take another look."`.
  - Both carry `run_id`.
- `chore_new(db, assignment) -> None`: `chore_new` to the assignment's kids, title `f"New chore: {title}"`, body `f"Due {h:mm AM/PM}"` when `due_time` is set, else None.
- `points_taken(db, kid_id, amount, note, by_id) -> None`: `points_taken`, title `f"{by name} took {amount} points"`, body = note. Called from `economy.deduct` only when the amount actually taken > 0.
- `parent_reply(db, thread, author, body) -> None`. Only when `author.role == PARENT` and the thread kind is `chore` (kids of the run) or `private` (`thread.kid_id`).
  - Kind `chat_message`.
  - Title `f"{author name} replied on {title}"` for a chore thread, `f"{author name} sent you a message"` for a private one.
  - Body `body[:120]`, or "Sent a photo" when the body is empty.
  - Carries `thread_id`, plus `run_id` for a chore thread.

- [ ] **Step 1:** Write the tests:
  - `test_approve_alerts_kid`: kid inbox has `chore_approved` "+10 points".
  - `test_send_back_alerts_kid_with_note`.
  - `test_deduct_alerts_kid` (chore deduct and profile deduct both). Also: balance 0 → no alert.
  - `test_new_assignment_alerts_each_kid`: 2 kids → 2 rows.
  - `test_parent_reply_alerts_kid_not_family`: chore thread → alert; family thread → none; kid's own message → none.
  - `test_parent_never_gets_kid_kinds`: parents' inboxes contain none of the 7 new kinds after all the above.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and call from the listed sites.
- [ ] **Step 4:** Run → PASS; full backend checks.
- [ ] **Step 5:** Commit `feat(kid): alert kids on approvals, send-backs, deductions, new chores and replies`.

### Task 4: Time-based kid alerts (due soon, missed, lock warning)

**Files:**
- Create: `backend/app/services/kid_alerts.py`
- Modify: `backend/app/lock/loop.py` (`_run_once`)
- Test: `backend/tests/test_kid_alerts.py` (new)

**Interfaces — Produces:**
- `scan(db, now_utc: datetime) -> int`: creates the due alerts, commits, and returns the count. It covers today's runs (`svc.day_runs(db, svc.today(db, now))`) whose `svc.state(run) == "todo"`, for each kid in `run_kid_ids`.
- Targets:
  - The chore deadline `economy.deadline_utc(fam, run.day, run.assignment.due_time)`.
  - Each unticked step with `due_time`, via `deadline_utc(fam, run.day, step.due_time)`.
- Due soon, when `due - 30 min <= now < due`: kind `due_soon`, minutes `m = ceil((due-now)/60s)`.
  - Chore: dedup `f"soon:r{run.id}"`, title `f"{title} is due in {m} min"`.
  - Step: dedup `f"soon:s{run.id}:{step.id}"`, title `f"{step.title} is due in {m} min"`, body `f"Part of {title}"`.
- Missed, when `now >= due`: kind `missed_deadline`.
  - Chore: dedup `f"late:r{run.id}"`, title `f"{title} is late"`, body `f"It was due at {clock}. Finish it as soon as you can."` (clock in the family tz, like "4:30 PM").
  - Step: dedup `f"late:s{run.id}:{step.id}"`, title `f"{step.title} is late"`, body `f"Part of {title}"`.
- Lock warning, for each kid with ≥ 1 device:
  - `locked(t)` = any of the kid's devices has `not is_online(device_facts(db, d, fam, t), local_now(fam.timezone, t))`.
  - If not `locked(now)`, find the first `m` in 1..10 with `locked(now + m min)`. If found, send `lock_warning` with dedup `f"lock:{local lock time:%Y-%m-%dT%H:%M}"` and title `f"Internet goes off in {m} min"`.
  - Body: `f"Finish {left} more chore{'s' if left != 1 else ''} to keep it on."` when `left = total - approved` (from `svc.counts`) > 0, else "Time to wrap up."
- `loop._run_once`: after `push_blocked(...)`, run `kid_alerts.scan(db, datetime.now(UTC))` in its own `try/except Exception` that logs "Kid alerts failed". A failure must not affect the lock push.

- [ ] **Step 1:** Write the tests. Use a fixed `now`, family tz `America/New_York`, and call `scan` directly.
  - `test_due_soon_once`: chore due 17:00 local, now 16:40 → one `due_soon` "due in 20 min"; scan again → still one.
  - `test_missed_only_when_box_was_off`: now 17:05 with no earlier scans → `missed_deadline` only, no `due_soon`.
  - `test_step_deadlines`: step due 16:30, chore 18:00, now 16:10 → one step `due_soon` with body "Part of …".
  - `test_no_alert_for_submitted_or_skipped`.
  - `test_lock_warning`: kid device, allowed window ends 21:00, all chores approved, now 20:52 → "Internet goes off in 8 min", "Time to wrap up."; now 20:40 → none.
  - `test_lock_warning_counts_chores_left`: free window ends 18:00, 2 chores left, now 17:55 → "Finish 2 more chores to keep it on."
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; full backend checks.
- [ ] **Step 5:** Commit `feat(kid): due-soon, missed-deadline and lock-warning alerts`.

### Task 5: ntfy push sender

**Files:**
- Create: `backend/app/services/push.py`
- Modify: `backend/app/core/config.py`, `backend/app/services/inbox.py`
- Test: `backend/tests/test_push.py` (new)

**Interfaces — Produces:**
- Settings:
  - `NTFY_URL: str | None = None`: internal, backend → ntfy, e.g. `http://ntfy:80`.
  - `NTFY_PUBLIC_URL: str | None = None`: what phones use.
- `push.public_url() -> str | None`: `NTFY_PUBLIC_URL`, else `f"http://{host}:2586"` from the `BOX_URL` hostname, else None.
- `push.enabled() -> bool`: `bool(settings.NTFY_URL and public_url())`.
- `push.queue(db, user_id, kind, title, body) -> None`:
  - No-op unless `enabled()`, `kind in inbox.KID_KINDS`, and the user is a kid with a `push_topic`.
  - Otherwise appends `{"topic", "title", "message": body or "", "click": f"{BOX_URL}/kid" or None, "priority": 4 if kind in {"due_soon","missed_deadline","lock_warning"} else 3}` to `db.info.setdefault("push_out", [])`.
- SQLAlchemy listeners on `sqlalchemy.orm.Session`, registered at module import:
  - `after_commit` pops `push_out` and calls `_spawn(_send_all, items)`.
  - `after_rollback` drops `push_out`.
- `_spawn(fn, *args)` starts a daemon `threading.Thread`. Tests monkeypatch it to call inline.
- `send(item) -> None`: `httpx.post(f"{NTFY_URL}/", json=item, timeout=5)` (ntfy's JSON publish to the root URL). Any exception or non-2xx → `logger.warning("Push failed", …)`, never raised.
- `inbox.notify` calls `push.queue(...)` once per row it actually adds. Dedup-skipped rows don't push. Import `push` lazily inside `notify` to avoid an import cycle.

- [ ] **Step 1:** Write the tests:
  - `test_push_after_commit`: settings patched, kid with topic, notify `chore_approved`, commit → `send` called once with the topic and `priority` 3.
  - `test_no_push_on_rollback`.
  - `test_no_push_without_topic_or_config`.
  - `test_parent_kind_never_pushes`: `new_device` to a kid id → no send.
  - `test_send_swallows_errors`: `httpx.post` raises `httpx.ConnectError` → no exception.
  - `test_public_url_from_box_url`: `BOX_URL=http://192.168.1.20:3000` → `http://192.168.1.20:2586`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; full backend checks (the conftest leaves `NTFY_URL` unset, so nothing sends).
- [ ] **Step 5:** Commit `feat(push): send kid alerts to the box's ntfy after commit`.

### Task 6: Kid-phone setup API, ntfy service, blocker pin

**Files:**
- Create: `backend/app/api/kid_push.py`
- Modify: `backend/app/main.py` (include the router), `backend/requirements.txt` (add `segno==1.6.6`; install it into the venv with `…/pip install segno==1.6.6`), `docker-compose.prod.yml`
- Test: `backend/tests/test_kid_push.py` (new), `blocker/tests/test_firewall.py`, `blocker/tests/test_compose.py`

**Interfaces — Produces** (parent only, prefix `/api/v1/kids`):
- `GET /{kid_id}/push` → `{"enabled": bool, "server": str|None, "topic": str|None, "link": str|None, "qr_svg": str|None}`.
  - Disabled: everything except `enabled` is None.
  - Enabled: creates `kid.push_topic = secrets.token_urlsafe(18)` on first call.
  - `link = f"ntfy://{host[:port]}/{topic}?display={quote_plus(name + ' chores')}"`, plus `&secure=false` when the server is http.
  - `qr_svg` = segno SVG text of `link` (`segno.make(link).save(buf, kind="svg", scale=6, border=2, xmldecl=False)`).
- `POST /{kid_id}/push/reset` → the same shape with a new topic.
- Unknown kid → 404 "That kid doesn't exist. Pick a kid from the list."
- Prod compose:
  - New service `ntfy`: image `binwiederhier/ntfy:v2.11.0`, `command: serve`.
  - Its env: `NTFY_BASE_URL: ${NTFY_PUBLIC_URL:-http://task4ce.local:2586}`, `NTFY_CACHE_FILE: /var/cache/ntfy/cache.db`, `NTFY_CACHE_DURATION: 12h`.
  - Its ports: `"${NTFY_PORT:-0.0.0.0:2586}:80"`; volume `ntfy_cache:/var/cache/ntfy`; network `task4ce`; `restart: unless-stopped`.
  - Backend env gains `NTFY_URL: http://ntfy:80` and `NTFY_PUBLIC_URL: ${NTFY_PUBLIC_URL:-}`. Add the `ntfy_cache` volume.

- [ ] **Step 1:** Write the backend tests:
  - `test_push_disabled_shape`.
  - `test_push_creates_topic_once`: two GETs → same topic; `link` starts `ntfy://192.168.1.20:2586/` and has `secure=false`; `qr_svg` starts `<svg`.
  - `test_reset_rotates`.
  - `test_kid_token_forbidden`.
- [ ] **Step 2:** Write the blocker tests:
  - `test_locked_device_reaches_box_services` in `test_firewall.py`: render with `DEFAULT_LAN_CIDRS` and portal ip `192.168.1.2`. Assert the `ether saddr @blocked_mac ip daddr { … 172.16.0.0/12 … } accept` line comes before `ether saddr @blocked_mac drop`, and no prerouting line contains `2586`.
  - `test_prod_compose_has_ntfy` in `test_compose.py`, following that file's loading pattern: service `ntfy` exists, container port 80, network `task4ce`, and backend env has `NTFY_URL`.
- [ ] **Step 3:** Run backend `pytest tests/test_kid_push.py` and `cd blocker && /home/user/code/tskfrce-redesign/.venv/bin/python -m pytest -q tests/test_firewall.py tests/test_compose.py`. Expected: FAIL only on the new tests.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run → PASS; full backend checks; blocker tests from Step 3 → PASS.
- [ ] **Step 6:** Commit `feat(push): kid phone QR, ntfy box service, pin locked access to box services`.

### Task 7: Frontend types, hooks and kid chip rules

**Files:**
- Modify: `frontend/src/v2/types.ts`, `frontend/src/v2/hooks/useKid.ts`, `frontend/src/v2/hooks/useKids.ts`, `frontend/src/v2/hooks/usePreview.ts`
- Create: `frontend/src/v2/hooks/useKidPush.ts`, `frontend/src/v2/kid/kidChips.ts`
- Test: `frontend/tests/v2/kidChips.test.ts`

**Interfaces — Produces:**
- Types:
  - `type AgeGroup = 'little' | 'kid' | 'teen'`.
  - `Kid.age_group: AgeGroup`.
  - `KidToday.age_group: AgeGroup` and `locks_at: string | null`.
  - `KidChore.new?: boolean` and `done_at?: string | null`.
  - `KidBody.age_group?: AgeGroup`.
  - `KidPush {enabled, server, topic, link, qr_svg}`.
- Hooks:
  - `useMarkSeen()`: POST `/kid/chores/${id}/seen`. Silent no-op while previewing. Invalidates the kid today query.
  - `useKidPush(kidId)` (GET) and `useResetKidPush()` (invalidates that key).
- `usePreview.ts`:
  - `PREVIEW_MSG` is replaced by `previewMsg(): string` → `` `Preview only. Log in as ${name ?? 'the kid'} to do this.` ``.
  - `setPreviewName(name: string | null)` sets the module-level name.
  - `blocked()` uses `previewMsg()`. Update the imports of `PREVIEW_MSG`.
- `kidChips.ts`:
  - `type KidTone = 'back'|'late'|'soon'|'new'|'today'|'later'|'wait'|'done'`; `interface KidChipT { tone: KidTone; icon: string; label: string }`.
  - `clock(iso, tz?) => "4:30 PM"` and `clockShort(iso, tz?) => "4:30"`, via `toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })` with a try/catch fallback, as in `KidSteps.at`.
  - `kidChips(c: KidChore, now: number, tz?: string, little = false): KidChipT[]`: every chip that applies, in the Global Constraints priority order. `needs_you` → only wait; `done` → only done; `skipped` → `[]`.
  - `stepChip(s: KidStep, now, tz?): { tone: 'late'|'soon'|'later'; time: string } | null`: null when done or no `due_at`; late when past; soon within 60 min; else later.
  - `stepBadge(steps, i): string`: `String(i + 1)` when `steps[i].after_previous` or `steps[i + 1]?.after_previous`, else `'–'`.
  - `nextStep(steps): number`: index of the first step that is not done and not locked, or −1.
  - `stepHint(steps, i, tz?): string`, parts joined by " · ":
    - done → `Done at {clock(done_at)}`
    - locked → `Unlocks after step {n}`, where n = index + 1 of the nearest earlier undone step
    - the next step → `Do this next`
    - a `'–'` badge → `Any time`
    - plus `by {clock(due_at)}` when not done and due.
  - `kidSort(chores, now): KidChore[]`: rank todo-overdue 0, other todo 1, needs_you 2, done 3; within rank by `due_at` ascending (null last), then id.
  - `tally(chores) => { approved: number; total: number; left: number; todo: number; waiting: number }`, counting non-skipped chores only.

- [ ] **Step 1:** Write the tests, with `now` fixed, tz `America/New_York`, and `due_at` given as UTC ISO strings:
  - overdue → `['Overdue']` and little → `['Late!']`
  - 20 min left → "Due in 20 min" / "Hurry · 20 min"
  - due 19:30 local, 2h away → "Due 7:30" / "By 7:30"
  - `sent_back` + overdue → first chip "Sent back"
  - `new` + due in 2h → `['New', 'Due 7:30']`
  - needs_you → `['Waiting for OK']`
  - done → "Approved" / "Done"
  - `stepBadge` for `[A, B(after), C(after), D]` → `['1','2','3','–']`
  - `stepHint` locked C → "Unlocks after step 2 · by 6:00 PM"
  - `kidSort` puts overdue first and done last
  - `tally` ignores skipped
- [ ] **Step 2:** `npx jest kidChips` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; then tsc, lint and the full jest run.
- [ ] **Step 5:** Commit `feat(kid): age-group types, seen and push hooks, kid chip rules`.

### Task 8: Kid tokens and shared chore pieces (look of 08)

**Files:**
- Create: `frontend/src/v2/kid/kid-app.css`, `frontend/src/v2/kid/KidChip.tsx`, `frontend/src/v2/kid/ChoreParts.tsx`
- Modify: `frontend/src/v2/kid/TellParent.tsx`, `frontend/src/v2/kid/KidSteps.tsx`, `frontend/src/v2/kid/KidChecklist.tsx` (only to keep it compiling until Task 12)
- Test: `frontend/tests/v2/kidParts.test.tsx` (new); update `kidChecklist.test.tsx` if a label changes

**Interfaces — Produces:**
- `kid-app.css`:
  - `.k-app` light tokens: `--k-bg:#f4f7fa; --k-card:#fff; --k-ink:#1d2b53; --k-sub:#4a5a80; --k-line:#dfe5ee; --k-soft:#eef1f6; --k-sun:#ffc93c; --k-green:#5cc46f; --k-coral:#ff6b4a; --k-amber:#ffb020; --k-blue:#e4ecff; --k-lav:#e6dcff; --k-grid:rgba(29,43,83,.08); --k-shadow:4px 4px 0 var(--k-ink); --k-navy:#1d2b53`.
  - `[data-mantine-color-scheme='dark'] .k-app` dark tokens: `--k-bg:#141a2e; --k-card:#1d2747; --k-ink:#eef2ff; --k-sub:#a9b6d8; --k-line:#2e3b66; --k-soft:#25315a; --k-green:#6fd08a; --k-coral:#ff7a5c; --k-amber:#ffc04d; --k-blue:#26355f; --k-lav:#352c5c; --k-grid:rgba(255,255,255,.06); --k-shadow:4px 4px 0 #000`.
  - `.k-app` background: the 28px grid from mockup 10.
  - `.k-chip[data-tone]` per mockup 11 `.chip.c-*`. Light `back` text is `#a8321a`, dark `#ff9b85`. Sizes `data-size="sm|md|lg"` (lg = Little's 22px badge).
  - Import it from `KidChip.tsx` only, the way other v2 CSS is imported.
- `KidChip({ chip, size = 'md' })` renders `<span class="k-chip" data-tone data-size><Icon name={chip.icon}/>{label}</span>`. Also `PointsChip({ points, size, long? })`: sun chip with filled `star` and `+N` (long → "N points").
- `ChoreParts.tsx`:
  - `isReady(c)`: every subtask done, and a photo when `needs_photo`.
  - `whyNot(c)`: text, moved from KidChecklist's `why()`.
  - `PhotoButton({ c })`: moved from KidChecklist's `Photo`.
  - `DeductionCards({ c, onReply? })`: 08 `.ded` style, `remove_circle`, "{by_name ?? 'A parent'} took {n} points", reason, Reply only when `onReply`.
  - `SentBackCard({ c, onChat? })`: coral-tint card "Sent back: {last_note}", button "See the chat".
  - `NoteSent({ c })`: blue pill `check_circle` "Note sent: {label}".
- `TellParent.tsx` exports `TellParentSheet({ c, opened, onClose })` (controlled; the old trigger button is removed), per 08 sheet 2:
  - Heading "Tell Mom or Dad", sub "About: {title}".
  - 2-column grid of note buttons. Icon = note glyph (type notes) or the universal glyph. Universal notes are dashed; the selected one is sun with the sticker shadow and `aria-pressed`.
  - Textarea "Add a note (optional)", max 200.
  - Sun **Send** with the `send` icon, disabled until a note is picked.
- `KidSteps({ c, timezone, size = 'big', readOnly = false })`:
  - Row layout: badge (`stepBadge`; dashed circle for '–'), checkbox, title + hint (`stepHint`), and for `size='small'` a `KidChip`-styled time chip from `stepChip`.
  - Big (Kid/Little): 48px boxes, 22px text, the next step tinted `color-mix(in srgb, var(--k-sun) 28%, transparent)`.
  - Small (Teen): 20px boxes, 14px text.
  - Locked: `lock` glyph in the box, greyed, disabled.
  - Checkbox `aria-label` = step title.
- `KidChecklist` keeps working: a "Tell Mom or Dad" button opens `TellParentSheet`, and it uses `ChoreParts`.

- [ ] **Step 1:** Write the tests:
  - The sheet lists 3 type notes + 3 universal; Send posts `{label, text}`; "About: Clean the bathroom" shows.
  - `KidSteps` locked step: checkbox disabled, hint "Unlocks after step 2"; next step has hint "Do this next".
  - `DeductionCards` without `onReply` has no Reply button.
  - No `@tabler` import under `src/v2/kid` (`fs` grep inside the test).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; tsc, lint, full jest.
- [ ] **Step 5:** Commit `feat(kid): kid tokens, chips, steps, tell-a-parent sheet and deduction cards`.

### Task 9: Kid mode (9–12) — mockup 10

**Files:**
- Create: `frontend/src/v2/kid/modes/types.ts`, `frontend/src/v2/kid/modes/KidMode.tsx`, `frontend/src/v2/kid/modes/StatusBanner.tsx`, `frontend/src/v2/kid/modes/ChoreTile.tsx`, `frontend/src/v2/kid/modes/ChoreView.tsx`, `frontend/src/v2/kid/modes/modes.css`
- Test: `frontend/tests/v2/kidMode.test.tsx` (new)

**Interfaces — Produces:**
- `modes/types.ts`:
  ```ts
  export interface ModeProps {
    d: KidToday; name: string; avatar: string | null; now: number
    onDone: (id: number) => void; busyId: number | null
    onSeen: (id: number) => void        // already a no-op in preview
    onChat?: (id: number) => void       // undefined in preview and Little
  }
  ```
- `StatusBanner({ d, size: 'big' | 'strip' })`, used by Kid mode (big) and phone:
  - Locked: coral circle `lock` (filled), "Internet is paused", and "Finish {left} more chore(s) to turn it on". When `left === 0` the sub is "It comes back on in your allowed hours."
  - Unlocked: green circle `wifi`, "Internet is on", and "{left} chore(s) left today" or "All done for today. Nice work!".
  - Progress dots: one per chore (max 10), filled green with `check` for approved, `aria-label="{approved} of {total} done"`.
- `ChoreTile({ c, now, tz, onOpen })`:
  - Type glyph tile (72px soft; done → green `check`), name.
  - At most two chips: `PointsChip` + `kidChips(...)[0]`.
  - Thin green bar = steps done/total (only with steps).
  - Round ink → button `arrow_forward`. Done/waiting tiles are dimmed with the name struck through.
  - The whole tile is a `<button>` with `aria-label="Open {title}"`.
- `ChoreView({ c, d, now, onBack, onDone, busyId, onChat? })`:
  - "← All chores" back pill.
  - 88px sun type tile + 40px title.
  - Chips: `PointsChip long` and, when any step is chained, `format_list_numbered` "Do steps {first} → {last} in order".
  - `NoteSent` / `SentBackCard` / `DeductionCards`, then `KidSteps size="big"` and `PhotoButton` when `needs_photo`.
  - `bigacts` 2fr/1fr/1fr, 78px:
    - **I'm done!** (`task_alt`, sun; disabled and soft when `!isReady`).
    - **Tell Mom/Dad** (`campaign`, opens `TellParentSheet`; hidden when no `notes`).
    - **Chat** (`chat`, only with `onChat`).
  - Hint under the buttons: "Finish all the steps to press “I'm done!”", or `whyNot(c)` when a photo is missing.
  - Only todo chores that aren't `taken_by` get the actions. Others show their chip and "Waiting for Mom or Dad" / "Taken by {name}".
- `KidMode(props: ModeProps)`:
  - "Hi {name}!", `StatusBanner`, tiles grid (1 column < 600px, 2 columns ≥ 600px), `kidSort` order.
  - Opening a tile → `onSeen(id)` + `ChoreView`.
  - Empty list → "No chores today. Enjoy the free time."

- [ ] **Step 1:** Write the tests (fixture: two chores; one has chained steps, one a deduction):
  - The locked banner text is "Finish 2 more chores to turn it on".
  - Unlocked (`locked:false`) still shows both tiles, and the deduction card shows once the tile is opened.
  - Opening a tile calls `onSeen` and shows "All chores".
  - "I'm done!" is disabled until steps are ticked, with the hint text.
  - The New tile shows exactly 2 chips.
  - Chat is absent when `onChat` is undefined.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement to mockup 10 (sizes in its CSS).
- [ ] **Step 4:** PASS; tsc, lint, full jest.
- [ ] **Step 5:** Commit `feat(kid): Kid (9–12) mode with status banner, tiles and one-chore view`.

### Task 10: Teen mode (13+) — mockup 11

**Files:**
- Create: `frontend/src/v2/kid/modes/TeenMode.tsx`, `frontend/src/v2/kid/modes/TeenRow.tsx`, `frontend/src/v2/kid/modes/TeenDetail.tsx`
- Modify: `frontend/src/v2/kid/modes/modes.css`
- Test: `frontend/tests/v2/teenMode.test.tsx` (new)

**Interfaces — Produces:**
- `TeenMode(props: ModeProps)`, top to bottom:
  - Header "Today" with sub "{weekday} · {name}".
  - Stats strip, 4 cards:
    - Lock card: coral `lock` "Internet paused" + "{left} chores left" (+ " · night lock {clock(locks_at)}" when set). Unlocked: green `wifi` "Internet on" + "locks at {clock}" or "All done".
    - `task_alt` "{approved} / {total}" "done today".
    - `star` "{points_balance}" "points".
    - `local_fire_department` "{streak} days" "streak".
  - Filter pills: All · n / To do · n / Waiting · n / Done · n, from `tally`.
  - List, in `kidSort` order.
  - Detail: right panel ≥ 1100px; below that it replaces the list with "← All chores". The first row starts selected at ≥ 1100px; selecting a row calls `onSeen`.
- `TeenRow({ c, now, tz, selected, onSelect })`:
  - Grid `28px 32px 1fr auto auto`: status box (done/needs_you filled), type glyph, name + subline, `kidChips[0]`, `+{points}`.
  - Subline:
    - overdue → "Was due {clock}"
    - steps → "Step {done+1} of {n} · next by {clock}" (the part after · only when the next step has `due_at`)
    - sent back → `“{last_note}”`
    - New → "New today"
    - done/waiting → "Done {clock(done_at)}"
    - else → "Due {clock}" or "Any time"
  - A `<button>` with `aria-pressed={selected}`.
- `TeenDetail({ c, d, now, onBack?, onDone, busyId, onChat? })`:
  - Header 46px sun glyph, title, all `kidChips` + "+{n} pts".
  - `NoteSent`, `SentBackCard`, `DeductionCards`.
  - Section "Steps · in order {first} → {last}" (just "Steps" when nothing is chained) + `KidSteps size="small"`.
  - `PhotoButton`.
  - "Latest": the newest user message from `useThread('chore', String(c.id), !preview)`, "{author} · {clock}" + body. Hidden when there is none or in preview.
  - Actions:
    - full-width sun **Mark done** (`task_alt`); when not ready, disabled with label "Mark done · finish steps first".
    - **Tell Mom/Dad** (`campaign`).
    - **Chat** (`forum`, only with `onChat`).

- [ ] **Step 1:** Write the tests:
  - Overdue row sorts first and shows "Was due 4:30 PM".
  - The filter "Waiting · 1" shows only the waiting chore.
  - Stats show "2 / 6" and "860".
  - The disabled Mark done label.
  - At 800px (`window.matchMedia` mock), selecting a row shows "All chores" and hides the list.
  - The unlocked strip shows "Internet on" and the list still renders.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement to mockup 11.
- [ ] **Step 4:** PASS; tsc, lint, full jest.
- [ ] **Step 5:** Commit `feat(kid): Teen (13+) mode with stats, filters, list and detail`.

### Task 11: Little mode (5–8) — mockup 09

**Files:**
- Create: `frontend/src/v2/kid/modes/LittleMode.tsx`
- Modify: `frontend/src/v2/kid/modes/modes.css`
- Test: `frontend/tests/v2/littleMode.test.tsx` (new)

**Interfaces — Produces:**
- `LittleMode(props: ModeProps)`. `onChat` is ignored.
- Top row:
  - 76px sun avatar circle (emoji), "Hi {name}!".
  - Pill: locked → coral `wifi_off` "No games yet"; unlocked → green `wifi` "Games on!".
  - Stars, right-aligned: one 58px circle per chore (wrap past 8), sun + filled `star` for approved, `aria-label="{approved} of {total} done"`.
- **Do this now** card = the first todo chore of `kidSort` that isn't `taken_by`:
  - `onSeen(id)` in an effect when it changes.
  - 170px sun picture tile with the type glyph (110px), 52px name.
  - Chips (`size="lg"`, little wording): `kidChips(…, true)[0]` + `PointsChip`.
  - `NoteSent`, `DeductionCards` (no Reply), `KidSteps size="big"`, `PhotoButton`.
  - 96px green **I did it!** (`check_circle`; disabled until `isReady`, with `whyNot` as visible text).
  - 96px square ✋ button: `front_hand` icon, `aria-label="Tell Mom or Dad"`, opens `TellParentSheet`.
- No todo chore left: the card shows `celebration` "All done for today!", or `hourglass_top` "Waiting for Mom or Dad" when any chore is `needs_you`.
- **Next** queue: every other chore in `kidSort` order. Each is a 60px glyph tile + name + `kidChips(…, true)[0]` as small text with its icon. Overdue rows are coral with navy text; done rows dimmed, struck through, with a green `check` tile.
- Layout: stage `1fr 300px` at ≥ 900px, stacked below.

- [ ] **Step 1:** Write the tests:
  - The overdue chore is the "Do this now" one, and `onSeen` is called with its id.
  - The Next row of another overdue chore reads "Late!".
  - "I did it!" calls `onDone` when ready.
  - The ✋ button opens the sheet.
  - Locked shows "No games yet"; unlocked shows "Games on!" and still lists chores.
  - Nothing to do + one waiting → "Waiting for Mom or Dad".
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement to mockup 09.
- [ ] **Step 4:** PASS; tsc, lint, full jest.
- [ ] **Step 5:** Commit `feat(kid): Little (5–8) mode with do-this-now and next queue`.

### Task 12: Kid app shell, nav pages, full width, preview bar

**Files:**
- Create: `frontend/src/v2/kid/KidApp.tsx`, `frontend/src/v2/kid/KidNav.tsx`, `frontend/src/v2/kid/KidAlerts.tsx`, `frontend/src/v2/kid/MePage.tsx`
- Modify: `frontend/src/v2/kid/KidPage.tsx`, `frontend/src/v2/kid/RewardsSection.tsx` (heading prop), `frontend/src/v2/chat/ChatDock.tsx` (`launcher` prop + list event), `frontend/src/v2/chat/dock.ts` (`openChatList`), `frontend/e2e/chore-model.spec.ts` (kid selectors)
- Delete: `frontend/src/v2/kid/KidChecklist.tsx`, `frontend/src/v2/kid/UnlockedView.tsx`, and `frontend/tests/v2/kidChecklist.test.tsx` (its cases now live in the mode tests; move any case without a home into `kidMode.test.tsx`)
- Test: `frontend/tests/v2/kidApp.test.tsx` (new); update `kid.test.tsx` and `kidPreview.test.tsx`

**Interfaces — Produces:**
- `dock.ts` gains `openChatList(): void`, which dispatches `task4ce:open-chat-list`. `ChatDock` listens for it (`setPick(null); setOpen(true)`). New prop `launcher = true`: false hides the floating launcher button only.
- `type KidTab = 'chores' | 'rewards' | 'chat' | 'alerts' | 'me'`.
- `KidNav({ mode: AgeGroup, tab, onTab, badges: { chores: number; chat: number; alerts: number }, avatar })`:
  - Items:
    - Little: Chores `checklist`, Prizes `redeem`, Me `face`.
    - Kid: avatar, Chores `checklist`, Rewards `redeem`, Chat `chat`, Alerts `notifications`, spacer, Me `face`.
    - Teen: the same items with `forum` and `person` icons.
  - Little: the 84px bottom nav from 09 at every width.
  - Kid/Teen: rail ≥ 768px (Kid 104×92 sun-sticker active; Teen 60px with a 4px sun edge active); bottom bar < 768px.
  - Coral count badges with navy text, hidden at 0.
  - Each item is a `<button aria-current={tab === item ? 'page' : undefined}>`.
- `KidApp({ d, name, avatar, kidId, preview, onExit, canSwitch, done })`:
  - Wraps everything in `<div className="k-app">` (full viewport, no max-width, inner content max-width 1280px centred).
  - Holds `tab` state. Chat → `openChatList()` and stays on the current tab. In preview, Chat and Alerts show "Alerts and chat show on {name}'s own screen."
  - Mode by `d.age_group`: `LittleMode`, `TeenMode`, else `KidMode`.
  - Passes `onSeen = useMarkSeen().mutate`. `onChat = openChat('chore', id)` unless preview or Little.
  - Badges:
    - chores = `tally.todo`
    - chat = `useThreads(!preview).data?.total`
    - alerts = `useInbox(true).data?.unread`, polled only when `!preview && mode !== 'little'`
- Tabs:
  - **Rewards**: `RewardsSection` with heading "Rewards", or "Prizes" in Little.
  - **Alerts**: `KidAlerts`.
  - **Me**: `MePage`.
- `KidAlerts()`: `useInbox(true)` list.
  - Each row: kind glyph (`due_soon` `hourglass_bottom`, `missed_deadline` `alarm`, `lock_warning` `lock_clock`, `chore_new` `fiber_new`, `chore_approved` `check_circle`, `chore_sent_back` `undo`, `points_taken` `remove_circle`, `chat_message` `chat`, `redemption_decided` `redeem`, `badge_earned` `military_tech`, `level_up` `trending_up`), title, body, relative time, unread dot.
  - "Mark all read" (`useMarkAllRead(true)`). Tapping a row marks it read. Then a `chat_message` row with `run_id` calls `openChat('chore', String(run_id))`, any other row with `run_id` switches to the Chores tab, and a `chat_message` row without `run_id` calls `openChatList()`.
  - Empty: "Nothing new. Alerts about your chores show up here."
- `MePage({ name, avatar, progress, preview, onLocker, canSwitch, onExit, kidId })`: the `ProgressHeader` card, **Customize** (not in preview), `FamilySection`, and **Not me** when `canSwitch`.
- `KidPage.tsx`:
  - `Session` renders `KidApp` for every locked/unlocked state, keeping the Locker, `AwardOverlay` and `KidIntroSwipe` conditions.
  - Delete the 520px `maxWidth` from the authed `KidScreen` and from `KidPreview`. The PIN/picker screens keep the narrow `f-auth` column.
  - `KidScreen` drops `<Bell kid />` and mounts `ChatDock kid launcher={false}` only when the mode isn't Little. Keep OS notifications: call `useOsNotify` the way `Bell` does for kids (read `components/Bell.tsx`).
  - Preview bar (08 phone 3): sticky full-width `#292928` bar, accent `visibility` icon, "Viewing as {name} · preview", accent pill "Back to parent" with `arrow_back`. `KidPreview` calls `setPreviewName(name)` in an effect and clears it on unmount.
- e2e `chore-model.spec.ts`: the kid opens the Garage tile, uses "Tell Mom/Dad" instead of "Something wrong? Tell a parent", and expects "Internet is on" instead of "You're online".

- [ ] **Step 1:** Write the tests in `kidApp.test.tsx`:
  - `age_group` little/kid/teen render "Do this now" / "Internet is paused" / "done today".
  - Little has no Chat or Alerts nav.
  - At 1280px (matchMedia mock) the rail renders and `.k-app` has no max-width 520 style.
  - At 390px the bottom bar renders.
  - Alerts tab lists inbox items and "Mark all read" posts.
  - Preview: "I'm done!" toasts "Preview only. Log in as Leo to do this.", `/seen` is never requested, and the bar text is "Viewing as Leo · preview".
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement; update `kid.test.tsx`/`kidPreview.test.tsx` expectations to the new copy.
- [ ] **Step 4:** PASS; tsc, lint, full jest. `grep -rn "maxWidth: 520" frontend/src/v2/kid` → no output.
- [ ] **Step 5:** Commit `feat(kid): kid app shell with age modes, nav pages and full-width layout`.

### Task 13: Parent controls — age group and kid phones

**Files:**
- Create: `frontend/src/v2/manage/KidPushPane.tsx`
- Modify: `frontend/src/v2/manage/KidEditor.tsx`, `frontend/src/v2/manage/SettingsPage.tsx`, `frontend/src/v2/manage/KidDetail.tsx` (show the age group in the Profile card)
- Test: `frontend/tests/v2/kidEditor.test.tsx` (existing or new), `frontend/tests/v2/kidPushPane.test.tsx` (new)

**Interfaces — Produces:**
- `KidEditor`: an **Age group** field (after Avatar) of three cards, as in mockup 11 `.ages`:
  - "Little (5–8)": "Big buttons, one chore at a time, pictures over words."
  - "Kid (9–12)": "Big tiles, status banner, chips."
  - "Teen (13+)": "List + detail, stats, filters, smaller type."
  - Selected = 2px ink outline + 3px accent offset shadow (`aria-pressed`). Default "kid" for a new kid; only a changed value is sent as `age_group`.
- Settings: new section `{ id: 'notify', label: 'Notifications', description: 'Kid phones', icon: 'notifications' }` (after Hours) → `KidPushPane`.
- `KidPushPane`: `InfoBlock` "Kids get chore alerts on their own phone through the box. Nothing leaves your home." Then one `pk-panel` card per kid (`useKids`):
  - Avatar + name.
  - QR `<img alt="Kid phone code for {name}" src={`data:image/svg+xml;utf8,${encodeURIComponent(qr_svg)}`} width=168>`.
  - Steps "1. Install the ntfy app on {name}'s phone. 2. Scan this code with the phone camera." and "Or add it by hand: server {server}, topic {topic}" (mono).
  - **New code** button → `ConfirmDelete` "Make a new code?" / "{name}'s phone stops getting alerts until you scan the new code." → `useResetKidPush`.
  - `enabled: false` → one `InfoBlock`: "Kid phone alerts need the ntfy service on the box. Update the box, then come back here."
  - Fetch push info per kid only when the section is open.

- [ ] **Step 1:** Write the tests:
  - The editor sends `{age_group: 'teen'}` after picking Teen, and nothing when unchanged.
  - The pane renders the QR img alt and server/topic.
  - The New code confirm posts the reset.
  - The disabled copy.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement with parent tokens (`pk-*`, `p-btn`, `Icon`; no emojis except the kid avatar).
- [ ] **Step 4:** PASS; tsc, lint, full jest.
- [ ] **Step 5:** Commit `feat(manage): kid age group and kid phone alert codes`.

### Task 14: End-to-end and visual pass

**Files:**
- Create: `frontend/e2e/kid-app.spec.ts` (copy the login helpers and lab-device ownership from `chore-model.spec.ts`)
- Test: `scripts/lab.sh e2e`

- [ ] **Step 1:** Write the spec:
  - Parent creates kid "Ivy" (`age_group: 'teen'`) with a chained 2-step chore due in 20 min, plus a second chore.
  - Kid logs in: the Teen list shows "Due in 20 min" sorted first, and selecting it shows "Mark done · finish steps first".
  - Parent PATCHes the age group to `little`; after a reload the kid sees "Do this now" with that chore.
  - Parent approves the other chore; the kid's `/inbox` (via `kp.request` with the kid token) has `chore_approved`.
  - Parent opens View as kid at 1280×800: the page width is > 1000px and "Viewing as Ivy · preview" shows.
- [ ] **Step 2:** `scripts/lab.sh e2e` → all pass; no previously passing spec is skipped or deleted.
- [ ] **Step 3:** Visual check on the demo: open View as kid for a demo kid. For each age group (switch it in the kid editor), screenshot light and dark at 390×844, 820×1180 and 1280×800, next to mockups 08–11 (served via `python3 -m http.server` in the mockups folder). Fix drift in layout, sizes, colours, chip wording and icons. Run axe: 0 serious/critical.
- [ ] **Step 4:** Commit `test(e2e): kid app age modes and alerts`.
