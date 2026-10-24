# v2 Redesign Project 2: Points Economy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kids earn points automatically when chores are approved (plus a capped deadline bonus), and spend them on screen time or parent-made rewards, every spend approved by a parent, with an animated award screen.

**Architecture:** Points stay a ledger (`points` table, balance = sum). New `rewards` and `redemptions` tables hold the catalog and requests. One service module `app/services/economy.py` owns all point math (award, bonus, balance, spend) so routes stay thin. Approved screen time becomes `Override(source="bonus")` rows on the kid's devices, which the existing lock rules already honor. Frontend adds a parent requests inbox, a rewards manager, settings fields, a chore deadline field, and a kid rewards section with an award overlay.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, SQLite, pytest; Next.js + Mantine + TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-10-21-v2-teen-redesign-gamification-design.md` (section "2. Points economy").

Prerequisite: Project 1 (new look) merged into `feat/v2-teen-redesign`. Work in `/home/user/code/tskfrce-redesign`. Backend tests: `cd backend && python -m pytest tests -q` (CI installs `backend/requirements.txt`; locally `uv run --no-project --with-requirements requirements.txt python -m pytest tests -q`). Lint: `ruff format --check . && ruff check .` in `backend/`; frontend `npm run lint && npm run type-check && npx jest` in `frontend/`.

## Global Constraints

- Every spend is parent-approved. **Nothing is deducted until approval. Denied or never-answered requests cost nothing.**
- Points for a chore are awarded **once**, at parent approval, as `Points(points_type=TASK_COMPLETION, amount=task.points, reference_type="task", reference_id=task.id)`.
- Deadline timing uses `Task.submitted_for_approval_at` (when the kid marked it done), **not** approval time.
- Bonus is per chore and never exceeds `FamilySettings.early_bonus_cap` (parent-set, default `5`, range `0–50`). Formula (Claude's call): done ≥ 60 minutes before the deadline → `cap`; done by the deadline → `cap // 2`; later or no deadline → `0`. Bonus row: `Points(points_type=BONUS, reference_type="task_bonus", reference_id=task.id)`, only when > 0.
- Deadline = chore's `due_time` (`"HH:MM"`, family local time, optional) on the instance's chore day, in `FamilySettings.timezone`.
- Screen time price: `FamilySettings.screen_time_price` = points per 15 minutes (parent-set, default `20`, range `1–1000`). Requests are 15–120 minutes in steps of 15.
- Screen time spending is allowed only when `points_unlock_early` is on; that switch is relabeled in the UI to **"Kids can spend points on screen time"** (column name unchanged).
- Approved screen time = `Override(source="bonus", action="unlock", expires_at=now+minutes)` on every device the kid owns, then `trigger()`. It does **not** bypass allowed time windows (bedtime): existing `is_online` rule order already enforces that — keep it.
- Spending row: `Points(points_type=REDEMPTION, amount=-cost, reference_type="redemption", reference_id=redemption.id)`. Add `REDEMPTION = "redemption"` to `PointsType`.
- Rewards: name (1–100 chars), price (1–100000), optional single emoji `icon` (≤ 8 chars). Image upload deferred (Claude's call; spec said "optional image"). Delete = soft (`active=False`); its pending requests are denied.
- Errors use the app's plain, friendly tone with a next step (e.g. "You need 40 more points for that.").
- New migration revises `d4e5f6a7b8c9`.
- Files < 500 lines.

## Review Focus

1. **Double spend:** two pending requests whose total exceeds the balance, both approved → second approve returns 409 "not enough points", no deduction. (Task 3 test.)
2. **Double tap on approve/deny:** deciding an already-decided request → 409, exactly one ledger row. (Task 3 test.)
3. **Chore approved twice / retried:** exactly one `TASK_COMPLETION` row per task. (Task 1 test.)
4. **Kid with no devices asks for screen time:** rejected at request time with "Ask a parent to add your device first." (Task 3 test.)
5. **Screen time during bedtime window:** device stays offline while outside allowed windows even with an active bonus. (Task 3 test.)

---

### Task 1: Auto-award points on approval + deadline bonus

**Files:**
- Create: `backend/app/services/economy.py`
- Create: `backend/alembic/versions/e5f6a7b8c9d0_points_economy_settings.py`
- Modify: `backend/app/models/family.py` (add `early_bonus_cap`, `screen_time_price`)
- Modify: `backend/app/models/gamification.py` (`PointsType.REDEMPTION`)
- Modify: `backend/app/api/chores.py` (`approve` awards; `_out` and create accept `due_time`)
- Modify: `backend/app/schemas/chore.py` (`due_time` on `ChoreCreate`, `ChoreOut`)
- Modify: `backend/app/schemas/lock.py` `FamilyPatch` + `backend/app/api/family.py` `_fam_out` (two new settings)
- Modify: `backend/app/api/kid.py` `today` (each chore carries `due_time`)
- Test: `backend/tests/test_economy.py`

**Interfaces:**
- Produces (in `app/services/economy.py`):
  - `balance(db: Session, kid_id: int) -> int` — sum of `Points.amount` (0 if none). Replace the inline sum in `kid.py` with it.
  - `deadline_utc(fam: FamilySettings, chore_day: date, due_time: str | None) -> datetime | None` — naive UTC.
  - `bonus_for(done_utc: datetime | None, deadline: datetime | None, cap: int) -> int`
  - `award_chore(db: Session, task: Task, fam: FamilySettings) -> int` — adds the completion row and bonus row (if any), returns total awarded; caller commits. Chore day = `task.due_date.date()`.
- Chore `due_time` lives in `recurrence_pattern["due_time"]` (copied to instances by `make_instance`, which already copies the pattern). `ChoreCreate.due_time: str | None` validated `HH:MM` with the existing `_hhmm` validator from `schemas/lock.py`.
- `FamilySettings.early_bonus_cap: int = 5`, `screen_time_price: int = 20`, both non-null with server defaults; exposed in `GET/PATCH /api/v1/family` (`FamilyPatch` fields with `ge`/`le` from Global Constraints).

- [ ] **Step 1: Write failing tests** in `test_economy.py`:
  - `test_bonus_for`: cap 6, deadline 17:00 → done 15:59 → 6; done 16:30 → 3; done 17:00 → 3; done 17:01 → 0; deadline None → 0; cap 0 → 0.
  - `test_deadline_uses_family_timezone`: tz `America/New_York`, day 2026-10-21, `"17:00"` → `datetime(2026, 10, 21, 21, 0)`.
  - `test_approve_awards_points_once`: create chore worth 15, kid marks done, parent approves → one `TASK_COMPLETION` row of 15 and `GET /kid/today` `points_balance == 15`; approving again → 409 and still one row.
  - `test_approve_awards_capped_bonus`: chore with `due_time` set, `submitted_for_approval_at` 2h before deadline, cap 5 → balance `points + 5`.
  - `test_family_settings_roundtrip`: PATCH `early_bonus_cap=8, screen_time_price=30` → GET returns them; `early_bonus_cap=51` → 422.
- [ ] **Step 2: Run, expect FAIL.** `python -m pytest tests/test_economy.py -q`
- [ ] **Step 3: Model + migration.** Two columns on `family_settings` (`server_default="5"` / `"20"`), downgrade via `batch_alter_table`. Add enum value.
- [ ] **Step 4: Implement `economy.py`** per Interfaces; wire `award_chore` into `approve` before commit; add `due_time` to chore create/out and kid today.
- [ ] **Step 5: Run full backend suite + ruff, expect PASS** (the pre-existing `test_unlock_timer_expires` failure may remain; note it, don't fix it here).
- [ ] **Step 6: Commit** `feat(api): award chore points with capped deadline bonus`

---

### Task 2: Rewards catalog (parent CRUD)

**Files:**
- Create: `backend/app/models/reward.py` (`Reward`, `Redemption`)
- Create: `backend/app/api/rewards.py` (parent router)
- Create: `backend/app/schemas/reward.py`
- Create: `backend/alembic/versions/f6a7b8c9d0e1_rewards_and_redemptions.py` (revises `e5f6a7b8c9d0`)
- Modify: `backend/app/main.py` (mount router), `backend/app/models/__init__.py` if models are registered there
- Test: `backend/tests/test_rewards_api.py`

**Interfaces:**
- `Reward`: `id`, `name String(100)`, `price Integer`, `icon String(8) null`, `active Boolean default True`, `created_at`.
- `Redemption`: `id`, `kid_id FK users`, `kind String(12)` (`"screen_time" | "reward"`), `reward_id FK rewards null`, `minutes Integer null`, `cost Integer`, `status String(10)` (`"pending" | "approved" | "denied"`), `created_at`, `decided_at null`, `decided_by_id FK users null`, `seen_by_kid Boolean default False`.
- Parent routes (prefix `/api/v1`, `require_parent`): `GET /rewards` (active only) → `[{id,name,price,icon}]`; `POST /rewards`; `PATCH /rewards/{id}`; `DELETE /rewards/{id}` → 204, sets `active=False` and denies its pending redemptions.

- [ ] **Step 1: Failing tests:** create/list/patch; validation (`price=0` → 422, name 101 chars → 422); kid token → 403; delete hides it from list and flips a seeded pending redemption to `denied`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Models, migration, schemas, router.**
- [ ] **Step 4: Run backend suite + ruff + `tests/test_migrations.py`, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): parent rewards catalog`

---

### Task 3: Requests and approvals (screen time + rewards)

**Files:**
- Modify: `backend/app/services/economy.py` (spend logic)
- Modify: `backend/app/api/rewards.py` (parent decide routes)
- Modify: `backend/app/api/kid.py` (kid routes) — if it would pass 500 lines, put kid reward routes in `backend/app/api/kid_rewards.py` on the same `/api/v1/kid` prefix
- Test: `backend/tests/test_redemptions.py`

**Interfaces:**
- `economy.request(db, kid: User, kind: str, reward_id: int | None, minutes: int | None) -> Redemption` — validates: kind; reward exists and active; minutes in {15,30,…,120}; screen time requires `points_unlock_early` ("Screen time isn't turned on. Ask a parent.") and ≥1 owned device ("Ask a parent to add your device first."); `cost <= balance` ("You need N more points for that."). Computes `cost` (`reward.price` or `minutes // 15 * screen_time_price`). Adds a `Notification(type="redemption_request", action_url="/", data={"redemption_id": id})` for every parent. Raises `HTTPException(400|409)` with the messages above.
- `economy.decide(db, redemption: Redemption, parent: User, approve: bool) -> Redemption` — 409 "Someone already answered this request." if not pending; on approve re-checks balance (409 "Not enough points anymore.", status stays pending), writes the `REDEMPTION` ledger row, and for screen time adds bonus `Override`s on the kid's devices (`kid.devices` backref) then calls `app.lock.loop.trigger()` after commit.
- Kid routes (`require_kid`): `GET /kid/rewards` → `{balance, screen_time_price, screen_time_enabled, rewards:[{id,name,price,icon}], pending:[{id,kind,reward_id,minutes,cost}]}`; `POST /kid/redeem` body `{kind, reward_id?, minutes?}` → redemption; `GET /kid/awards` → approved + `seen_by_kid=False` → `[{id,kind,name,minutes,cost}]`; `POST /kid/awards/{id}/seen` → 204 (only own).
- Parent routes: `GET /redemptions?status=pending` → `[{id,kid_id,kid_name,kind,name,minutes,cost,created_at,kid_balance}]`; `POST /redemptions/{id}/approve`; `POST /redemptions/{id}/deny`.

- [ ] **Step 1: Failing tests** (one each): reward request → pending, balance unchanged; approve → balance minus price, award appears in `/kid/awards`, `seen` removes it; deny → balance unchanged; **two requests exceeding balance, approve both → second 409, one deduction**; **approve twice → 409, one ledger row**; screen time with switch off → 400; **no devices → 400 with the device message**; approved 30 min → bonus overrides on each kid device expiring in 30 min (±5 s) and `trigger` called (monkeypatch); **bonus does not bring a device online outside its allowed window** (build `DeviceFacts` via `device_facts` and assert `is_online` False); another kid can't mark someone else's award seen (404); parents receive a notification per request.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement service + routes.**
- [ ] **Step 4: Run backend suite + ruff, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): parent-approved screen time and reward requests`

---

### Task 4: Parent UI — settings, chore deadline, rewards manager, requests inbox

**Files:**
- Modify: `frontend/src/v2/types.ts` (`Family` + `early_bonus_cap`, `screen_time_price`; `Chore` + `due_time`; new `Reward`, `PendingRedemption`)
- Create: `frontend/src/v2/hooks/useRewards.ts` (`useRewards`, `useSaveReward`, `useDeleteReward`, `usePendingRedemptions` with `refetchInterval: 30_000`, `useDecideRedemption`)
- Modify: `frontend/src/v2/manage/SettingsPage.tsx` (relabeled switch; `NumberInput`s "Screen time price (points per 15 min)" and "Early finish bonus cap")
- Modify: `frontend/src/v2/manage/ChoreEditor.tsx` (optional "Due by" time input → `due_time`)
- Create: `frontend/src/v2/manage/RewardsPanel.tsx` (list + add/edit/delete; mount in `KidsPage.tsx`)
- Create: `frontend/src/v2/today/RequestsPanel.tsx` (pending list, Approve / Deny per row, shows cost and kid balance; mount at top of `TodayPage.tsx`, hidden when empty)
- Test: `frontend/tests/v2/rewards.test.tsx`; extend `manage.test.tsx` for settings/chore fields

**Interfaces:**
- Consumes: Task 1–3 endpoints exactly as named. Project 1 classes (`.f-card`, `.f-card-head`, `.f-num`, `.f-cap`, gamer-cut controls).
- Invalidate `['redemptions']`, `['today']`, `['family']` after decisions/saves as relevant.

- [ ] **Step 1: Failing tests:** RequestsPanel renders "Maya wants Movie night (150)" style row and Approve posts `/redemptions/7/approve`; Deny posts `/deny`; panel absent when list empty; RewardsPanel add sends `POST /rewards` `{name, price, icon}`; Settings saves `screen_time_price` and shows the new switch label; ChoreEditor sends `due_time: "17:00"` when set and omits it when blank.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Copy uses existing tone; toasts via `toastOk`/`toastFail`.
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): parent rewards, requests inbox and economy settings`

---

### Task 5: Kid UI — rewards, requests, award screen

**Files:**
- Create: `frontend/src/v2/hooks/useKidRewards.ts` (`useKidRewards`, `useRedeem`, `useAwards` with `refetchInterval: 15_000`, `useMarkAwardSeen`; all `kid: true`, same expiry handling as `useKidToday`)
- Create: `frontend/src/v2/kid/RewardsSection.tsx` (balance in `.f-num`; screen time picker 15–120 step 15 with live cost; reward cards with progress bar `min(balance/price,1)` and "Request" enabled only when affordable and not already pending; pending items show "Waiting for a parent")
- Create: `frontend/src/v2/kid/AwardOverlay.tsx` + `frontend/src/v2/kid/award.css` (full-screen overlay for the oldest unseen award; reward = big celebration: scale-in card, burst of CSS confetti, glow; screen time = small toast-style celebration; "Nice!" button marks seen; `prefers-reduced-motion` shows the same content with no motion; focus moves to the button; Escape also closes and marks seen)
- Modify: `frontend/src/v2/kid/KidPage.tsx` (mount section and overlay for a logged-in kid)
- Test: `frontend/tests/v2/kidRewards.test.tsx`

**Interfaces:**
- Consumes: kid endpoints from Task 3.

- [ ] **Step 1: Failing tests:** balance 120, reward price 300 → progress bar `aria-valuenow=40` and Request disabled; reward price 100 → Request posts `/kid/redeem {kind:"reward", reward_id}`; screen time 30 min with price 20 shows cost 40 and posts `{kind:"screen_time", minutes:30}`; screen time hidden when `screen_time_enabled` false; award present → dialog with reward name, button posts `/kid/awards/{id}/seen`; reduced motion → overlay still renders (mock `matchMedia`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Pure CSS animations (no new dependency).
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): kid rewards and award celebration`
