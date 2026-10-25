# v3 Plan E — Rewards, screen time, badges, chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Glyph icons, hidden rewards and approval-off rewards; screen time moved under Rewards with daily limits, auto-approve, allowed-hours rule and per-kid limits; reward history with CSV; badge overview, award notes and recent awards; chat Notes tab, typing indicator, @mentions, message search and quick replies with "Approve + Great job!".

**Architecture:** One alembic migration adds every column/table. Backend: rewards/redemptions stay in `api/rewards.py` + `services/economy.py`; new `services/screen_time.py` + `api/screen_time.py`; kid reward routes move out of the 400-line `api/kid.py` into `api/kid_rewards.py`; badges grow in `api/badges.py` + `services/badges.py`; chat gains `services/typing.py` (in-memory) and small additions to `services/chat.py`/`api/chat.py`. Frontend: Kids & chores → Rewards and Badges become fixed sub-page lists (Requests · Catalogue · Screen time · History; All badges · Custom badges · Recent awards), each pane its own file; chat additions are split into small components beside `ThreadView.tsx`.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (SQLite, `batch_alter_table`), pytest; Next.js pages router, React Query, Mantine, jest, Playwright (`frontend/e2e`).

**Spec:** `docs/superpowers/specs/2026-10-24-v3-redesign-design.md` §8, §3.4 (Rewards, Badges), §3.5 (Chat), §2.2–2.6, §11 erratum 1, §12. Mockup `docs/superpowers/specs/2026-10-24-v3-redesign-mockups/02-parent-screens.html` (Kids & chores → Rewards, Badges; Chat). Read both before each frontend task.

**Repo:** `/home/user/code/tskfrce-v3a`, branch `feat/v3-parent-restyle`. Backend venv: `/home/user/code/tskfrce-redesign/.venv/bin`.

## Already built (consume, don't rebuild)

- Chat: chore threads with notes (`note_label`), step/photo replies (`step_id`, `step_title`), edit/delete, Teams-style reactions (`message_reactions`, `chat/Reactions.tsx`, `chat/MessageActions.tsx`), GIFs, client-side title search and All/Chores/Family tabs in `chat/ThreadList.tsx`, `ThreadHead` with Approve/Send back/Deduct, `ThreadSidePanel`.
- Economy: `economy.deduct`, points reason `'deduction'`, `economy.request` / `economy.decide`, `economy.deadline_utc`.
- `parent/GlyphPicker.tsx` (search + grid, takes `choices`), `parent/Icon.tsx` (ligature font, any glyph name works, loaded globally in `pages/_app.tsx`), `parent/Chip.tsx`, `withUndo` in `v2/notify.tsx`.

## Global Constraints

- Files under 500 lines; split before crossing.
- Semantic commits, each ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push. Stage only the files your task lists (`git add <paths>`, never `-A`/`.`); other agents commit in this checkout. On `index.lock`, wait a few seconds and retry.
- Before each commit — backend: `cd backend && /home/user/code/tskfrce-redesign/.venv/bin/ruff format --check . && /home/user/code/tskfrce-redesign/.venv/bin/ruff check . && /home/user/code/tskfrce-redesign/.venv/bin/python -m pytest -q`; frontend: `cd frontend && npx tsc --noEmit && npm run lint && npx jest`. Fix format with `ruff format <file>`; never run prettier.
- A live demo backend runs from this checkout with `--reload`. Do not start, stop or restart servers. Do not run `alembic upgrade` against the demo database (see Task 13).
- Parent UI: `--p-*` tokens, `Chip`, `Icon` (Material Symbols names), `p-btn`; no emojis in parent UI; no neon text or thin neon bars on light backgrounds (bars: ink on `#e4e4e1` in light, accent on `#3d3d3b` in dark); every chip has an icon.
- Kid UI: fridge look stays (Plan C restyles layout). Kid screens show a **custom badge's glyph**; **built-in badges keep their emojis** on kid screens.
- Every icon field stored in this plan (reward icon, custom badge icon) is a **Material Symbols name** matching `^[a-z0-9_]{1,40}$`, chosen with the shared `GlyphPicker`.
- Unknown built-in badge key on parent screens → glyph `military_tech`. Reward with no/unknown icon → `redeem`.
- Copy is plain, sentence case. Error `detail` strings are full sentences.
- Plan C owns kid layout/alerts, Plan D owns hours/devices/lock windows, Plan F owns Apprise + bell. This plan notifies through the existing `inbox.notify` with **existing kinds only** (no `ck_notification_kind` change).

## Decisions taken (owner may override)

1. Family screen-time defaults keep today's behaviour: `screen_max_minutes` = NULL (no daily max), `screen_auto_approve` = off, `screen_only_allowed_hours` = on.
2. "Bought today" = minutes of the kid's `pending` + `approved` screen-time requests created since the current chore day's reset time (`fam.reset_time`). Pending counts so a kid can't queue past the limit.
3. Effective daily max = the smaller of the family max and the kid's own max (either may be NULL = no limit). Per-kid `min_points` is compared with the balance **before** the purchase.
4. `only_in_allowed_hours` on: a request made while the kid's devices are outside allowed hours is refused (409) so no points are wasted; bought minutes never unlock outside allowed hours (today's rule). Off: bought minutes unlock even outside allowed hours.
5. Approval-off rewards and auto-approved screen time are approved instantly by "the system" (`decided_by_id` NULL, `redemptions.auto = 1`); parents get an inbox `redemption_decided` ping ("Leo got Pick dinner" / "Approved automatically · 120 points"). They never appear in Needs you.
6. Hidden reward (`visible = 0`): kids don't see it and can't request it; pending requests for it stay pending. Delete stays a soft delete (`active = 0`) as today.
7. Approve all: oldest first; requests that are no longer affordable are skipped and reported (`{"approved": n, "skipped": m}`).
8. Decline/approve note (optional, ≤200) is saved on the redemption, shown in History and used as the kid's notification body.
9. History CSV is built in the browser from the history JSON (API uses bearer tokens, so a plain download link can't authenticate). Columns: `date,kid,item,kind,status,points,decided_by,note`.
10. Quick replies: `family_settings.quick_replies` JSON text, NULL → defaults `["Looks good", "Can you redo it?", "Retake the photo"]`; max 8, each 1–60 chars; parents only. Tapping a reply **sends it at once**. The combined chip always says "Approve + “Great job!”" and posts the fixed text "Great job!" (not editable); it shows only on a chore thread whose run is `needs_you`.
11. Typing indicator is in-memory (single uvicorn process, see `backend/entrypoint.sh`), 6 s TTL; clients ping at most every 3 s; everyone in the thread (kids too) sees it.
12. @mentions match `@` + first word of a member's display name, case-insensitive; mentioned members (not the author) get an inbox `chat_message` ping; nothing is stored per mention. The **@ button** is in the parent composer only; kids can still type `@Mom`.
13. Chat search: server search over user-message bodies (min 2 chars) merged with the existing client-side title search.
14. Recent awards = last 7 days, newest first, max 50; covers built-in tiers and parent awards.
15. Icon migration: an existing value already matching `^[a-z0-9_]+$` is kept (Plan A's picker saved short glyph names); reward emojis map by the table in Task 1, else `redeem`; custom badge emojis → `military_tech`.
16. The mockup's "· iPad" on a screen-time request card is omitted (a kid may have several devices).

## Review Focus

1. Two pending requests each affordable alone but not together: Approve all approves the older and skips the newer; nothing goes negative. → Task 2 `test_approve_all_skips_unaffordable`.
2. Daily max at the boundary: bought 45 of 60, ask 15 → OK; ask 30 → 409 with "15 more minutes"; requests from before today's reset time don't count. → Task 3 `test_daily_max_boundary_and_reset`.
3. Auto-approve while the kid is short of points, or outside allowed hours: refused with 409 and no `points`/`overrides` rows written. → Task 3 `test_auto_approve_refusals_write_nothing`.
4. Migration on real data: emoji with a variation selector (`🛏️`) maps to `bedtime`; an unknown emoji → `redeem`; a stored glyph name `star` is kept; custom badge `🏅` → `military_tech`. → Task 1 `test_icon_migration`.
5. @mention of a name shared by nobody in the thread (e.g. a kid not on that chore) pings nobody; the author mentioning themself pings nobody. → Task 6 `test_mentions_only_members`.

---

### Task 1: Migration and models

**Files:**
- Create: `backend/alembic/versions/p5e1a2b3c4d5_rewards_v3.py`
- Create: `backend/app/models/screen_time.py`
- Modify: `backend/app/models/reward.py`, `backend/app/models/badge.py`, `backend/app/models/family.py`, `backend/app/models/__init__.py`
- Test: `backend/tests/test_rewards_migration.py` (new), `backend/tests/test_migrations.py` (existing parity test must still pass)

**Interfaces — Produces:**
- `Reward.icon` String(40) nullable; `Reward.visible` Bool NOT NULL default True (server_default "1"); `Reward.needs_approval` Bool NOT NULL default True (server_default "1").
- `Redemption.auto` Bool NOT NULL default False (server_default "0"); `Redemption.note` String(200) nullable.
- `CustomBadge.icon` String(40) NOT NULL.
- `BadgeAward.note` String(200) nullable; `BadgeAward.awarded_by_id` FK `users.id` ondelete SET NULL nullable.
- `FamilySettings.screen_max_minutes` Int nullable; `screen_auto_approve` Bool NOT NULL default False (server_default "0"); `screen_only_allowed_hours` Bool NOT NULL default True (server_default "1"); `quick_replies` Text nullable (JSON list).
- `ScreenTimeLimit(__tablename__ "screen_time_limits", kid_id Int PK FK users.id ondelete CASCADE, max_minutes Int nullable, min_points Int nullable)` in `models/screen_time.py`, exported from `models/__init__.py`.

- [ ] **Step 1:** Run `cd backend && /home/user/code/tskfrce-redesign/.venv/bin/alembic heads`. Plans C/D may have added migrations since this plan was written (it was `k4d5e6f7a8b9`). Use the **single current head** as `down_revision`. If there are two heads, stop and report BLOCKED.
- [ ] **Step 2:** Write `test_icon_migration` in `tests/test_rewards_migration.py` (copy the subprocess pattern from `tests/test_migrations.py`): upgrade a temp DB to the head from Step 1, insert rewards with icons `"🛏️"`, `"🍦"`, `"🦄"`, `"star"`, `None` and custom badges `"🏅"`, `"verified"`, upgrade to head, assert reward icons `bedtime`, `icecream`, `redeem`, `star`, `None` and badge icons `military_tech`, `verified`; assert new reward rows have `visible == 1`, `needs_approval == 1`, family row `screen_only_allowed_hours == 1`, `screen_auto_approve == 0`, `screen_max_minutes IS NULL`; `screen_time_limits` table exists.
- [ ] **Step 3:** Run `/home/user/code/tskfrce-redesign/.venv/bin/python -m pytest tests/test_rewards_migration.py -q` → FAIL.
- [ ] **Step 4:** Write the migration (`revision = "p5e1a2b3c4d5"`). Add columns with `batch_alter_table`, widen `rewards.icon` and `custom_badges.icon` to String(40), create `screen_time_limits`, add the FK on `badge_awards.awarded_by_id` with a named constraint. Data step in Python: strip `"️"`, keep values matching `^[a-z0-9_]+$`, map rewards with this literal dict (don't import app code), else `redeem`; custom badges non-glyph → `military_tech`:
  `🎬 movie, 🍿 movie, 🍦 icecream, 🍨 icecream, 🛏 bedtime, 😴 bedtime, 🌙 bedtime, 🍕 local_pizza, 🍔 restaurant, 🍽 restaurant, 🎮 sports_esports, 🕹 sports_esports, 🌳 park, 🏞 park, 🎂 cake, 🍰 cake, 🧸 toys, ⏰ timer, ⏱ timer, 📱 timer, 💵 payments, 💰 payments, 📚 menu_book, 🎁 redeem, 🛍 shopping_bag, ⚽ sports_soccer, 🎨 palette, 🎵 music_note, 🏊 pool, 🚲 pedal_bike, 🍪 cookie, 🍬 cookie, 🍭 cookie, 🎉 celebration, ⭐ star`.
  Downgrade drops the table and columns (icons stay as glyph names).
- [ ] **Step 5:** Add the model columns and `models/screen_time.py` listed above.
- [ ] **Step 6:** Run `pytest tests/test_rewards_migration.py tests/test_migrations.py -q` → PASS; full suite → PASS.
- [ ] **Step 7:** Commit `feat(rewards): schema for glyph icons, hidden and auto rewards, screen-time limits, award notes`.

### Task 2: Rewards catalogue, approval-off rewards, requests

**Files:**
- Create: `backend/app/schemas/glyph.py`, `backend/app/api/kid_rewards.py`
- Modify: `backend/app/schemas/reward.py`, `backend/app/api/rewards.py`, `backend/app/services/economy.py`, `backend/app/api/kid.py` (remove the moved routes and `RedeemIn`), `backend/app/main.py` (include `kid_rewards_router`)
- Test: `backend/tests/test_rewards_api.py`, `backend/tests/test_redemptions.py`

**Interfaces — Produces:**
- `schemas/glyph.py`: `Glyph = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-z0-9_]{1,40}$")]`.
- `RewardCreate {name, price, icon: Glyph | None = None, visible: bool = True, needs_approval: bool = True}`; `RewardPatch` same fields optional (icon clearable with `null`, as today). Bad icon → 422.
- Parent `_out(r)` adds `visible`, `needs_approval`. `GET /api/v1/rewards` lists active rewards including hidden ones.
- `economy.decide(db, redemption, parent: User | None, approve: bool, note: str | None = None) -> Redemption`: `parent is None` ⇒ `auto=True`, `decided_by_id=None`, override `created_by_id=None`. Saves `note`. Kid notification body = `note` when given, else today's text. Callers that pass `parent` keep working.
- `economy.request(...)`: reward must be `active and visible` (else the existing 400). When the reward has `needs_approval=False`: create, flush, `decide(db, red, None, True)`, and notify parents `inbox.notify(db, inbox.parents(db), "redemption_decided", f"{kid.full_name} got {label}", f"Approved automatically · {cost} points", redemption_id=red.id)` instead of the `redemption_request` ping. (Screen-time auto-approve plugs into the same branch in Task 3: expose `def _auto(fam, kind, reward) -> bool` returning `kind == "reward" and not reward.needs_approval` for now.)
- `POST /api/v1/redemptions/{rid}/approve` and `/deny` accept an optional body `{note: str ≤200 | None}` (`DecideIn`, body optional so existing callers without a body still work).
- `POST /api/v1/redemptions/approve-all` (parent) → `{"approved": int, "skipped": int}`; pending oldest first; a request whose cost > current balance is skipped (left pending).
- `GET /api/v1/redemptions` items add `kid_balance_after = kid_balance - cost`.
- `api/kid_rewards.py`: `router = APIRouter(prefix="/api/v1/kid", tags=["kid"])` holding the moved `GET /rewards`, `POST /redeem`, `GET /awards`, `POST /awards/{id}/seen` unchanged except: `/rewards` hides `visible=False` rewards and each reward adds `needs_approval`; `/redeem` returns `status` (already) so the kid UI sees `approved` for instant ones. Import `require_kid`, `view_kid` from `app.api.kid`.

- [ ] **Step 1:** Tests: `test_reward_glyph_and_flags` (POST `{name, price, icon:"movie", visible:false, needs_approval:false}` → out has the three fields; icon `"🎬"` → 422), `test_hidden_reward_invisible_to_kid` (kid `/kid/rewards` omits it; kid redeem → 400), `test_no_approval_reward_pays_now` (kid redeems → response `status == "approved"`, balance drops by price, redemption `auto` true, every parent has a `redemption_decided` notification, no `redemption_request`), `test_decline_note_reaches_kid` (deny with `{"note":"let's talk Sat"}` → kid's `redemption_decided` notification body == that note; redemption `note` saved), `test_approve_all_skips_unaffordable` (balance 300; two pending 200-point requests → `{"approved":1,"skipped":1}`, balance 100, second still pending).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Move the kid reward routes verbatim first, run the suite, then change behaviour.
- [ ] **Step 4:** Run → PASS; full suite + ruff → PASS.
- [ ] **Step 5:** Commit `feat(rewards): glyph icons, hidden and no-approval rewards, notes, approve all`.

### Task 3: Screen time limits, auto-approve, allowed hours

**Files:**
- Create: `backend/app/services/screen_time.py`, `backend/app/api/screen_time.py`
- Modify: `backend/app/services/economy.py`, `backend/app/lock/rules.py`, `backend/app/lock/state.py`, `backend/app/api/kid_rewards.py`, `backend/app/main.py`
- Test: `backend/tests/test_screen_time.py` (new), `backend/tests/lock/test_rules.py`

**Interfaces — Produces:**
- `lock/rules.py`: `DeviceFacts.bonus_any_hours: bool = False` (last field, defaulted so existing constructors work); `def in_allowed(f: DeviceFacts, now_local: datetime) -> bool` = every allowed set has a window containing now (true when there are none); `is_online` uses `in_allowed` and, right after the `unassigned` branch, returns True when `f.bonus_active and f.points_unlock_early and f.bonus_any_hours`.
- `lock/state.py::device_facts` sets `bonus_any_hours=not fam.screen_only_allowed_hours`.
- `services/screen_time.py`:
  - `def day_start_utc(fam, now_utc: datetime) -> datetime` = `economy.deadline_utc(fam, current_chore_day(fam, now_utc), fam.reset_time)`.
  - `def bought_today(db, fam, kid_ids: list[int], now_utc) -> dict[int, int]` (minutes; pending + approved, `created_at >= day_start_utc`).
  - `def limit_for(db, fam, kid_id) -> tuple[int | None, int | None]` → (effective max minutes, min points).
  - `def in_allowed_hours(db, kid: User, now_utc) -> bool` → any of the kid's devices `in_allowed(device_facts(...), local_now)`; a kid with no devices → True.
  - `def check(db, fam, kid: User, minutes: int, now_utc) -> None` raising, in this order:
    `409 "You can buy screen time once you have {min_points} points."` when balance < min_points;
    `409 "You've had all your screen time for today."` when left ≤ 0, else `409 "That's over today's limit. You can buy {left} more minutes today."` when minutes > left;
    `409 "Screen time only works during your allowed hours."` when `screen_only_allowed_hours` and not `in_allowed_hours`.
- `economy.request` calls `screen_time.check` for screen time after the existing checks; `_auto` also returns True for `kind == "screen_time" and fam.screen_auto_approve`; the auto parent ping body for screen time is `f"Approved automatically · {cost} points"`, title `f"{kid.full_name} bought {minutes} min of screen time"`. The existing "need N more points" check stays first, so a short kid is refused before anything is written.
- `api/screen_time.py` (parent, prefix `/api/v1/screen-time`):
  - `GET ""` → `{enabled (points_unlock_early), price, max_minutes_per_day, auto_approve, only_in_allowed_hours, reset_time, avg_chore_points (round mean of non-archived chores' points, 0 if none), kids: [{kid_id, name, balance, bought_today, max_minutes (effective), limit: {max_minutes, min_points} | null}]}` (active kids by id).
  - `PATCH ""` body all optional `{enabled: bool, price: 1–1000, max_minutes_per_day: int 15–480 multiple of 15 | null, auto_approve: bool, only_in_allowed_hours: bool}` → same as GET; calls `trigger()` from `app.lock.loop`.
  - `PUT "/limits/{kid_id}"` body `{max_minutes: 15–480 multiple of 15 | null, min_points: 1–100000 | null}` → GET payload; unknown kid → 404 "We couldn't find that kid."; both null → deletes the row.
  - `DELETE "/limits/{kid_id}"` → 204.
- Kid `/kid/rewards` adds `screen: {enabled, price, auto: bool (screen_auto_approve), only_in_hours: bool, max_today: int | null, bought_today: int, left_today: int | null, min_points: int | null, in_hours: bool}`; keep `screen_time_price` and `screen_time_enabled` for now.

- [ ] **Step 1:** Tests in `tests/lock/test_rules.py`: `test_bonus_any_hours_unlocks_outside_window` (outside allowed window, bonus active, flag on → online; flag off → offline).
- [ ] **Step 2:** Tests in `test_screen_time.py`: `test_daily_max_boundary_and_reset` (family max 60, price 20; kid has approved 45 min today → ask 15 ok; then ask 15 → 409 "You've had all your screen time for today."; a 60-min request dated before today's reset doesn't count), `test_kid_limit_tighter_than_family` (family 60, kid 30 → GET kid `max_minutes == 30`), `test_min_points` (min 100, balance 95 → 409 copy above), `test_auto_approve_pays_and_unlocks` (auto on → status approved, `auto` true, override rows for the kid's devices, parents get `redemption_decided`), `test_auto_approve_refusals_write_nothing` (short of points → 409, and outside allowed hours with only-in-hours on → 409; in both cases no new `points`, `overrides` or `redemptions` rows), `test_patch_and_limits_api` (PATCH `max_minutes_per_day` 50 → 422, 60 → 200; PUT limit then DELETE → `limit` null; kid token → 403).
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement. Freeze time the way existing lock tests do (grep `tests/lock/test_state.py` for how `now_utc` is passed); services take `now_utc` so tests pass it directly.
- [ ] **Step 5:** Run → PASS; full suite + ruff → PASS.
- [ ] **Step 6:** Commit `feat(screen-time): daily and per-kid limits, auto-approve, allowed-hours rule`.

### Task 4: Reward history API

**Files:**
- Modify: `backend/app/api/rewards.py` (split redemptions into `api/redemptions.py` if `rewards.py` passes 300 lines; keep `redemption_name` importable from `app.api.rewards`)
- Test: `backend/tests/test_redemptions.py`

**Interfaces — Produces:**
- `GET /api/v1/redemptions/history?days=30&kid_id=&kind=` (`days` 1–365, `kind` `reward|screen_time|None`) → `{"totals": {"spent": int (sum cost of approved), "screen_minutes": int (approved), "approved": int, "declined": int}, "rows": [{id, kid_id, kid_name, kind, name, minutes, cost, status ("approved"|"denied"), auto, decided_by_name | null, note, created_at, decided_at}]}`; decided rows only, `created_at` within `days`, newest first. Totals use the same filters.

- [ ] **Step 1:** Test `test_history_filters_and_totals`: one auto screen-time (30 min, 40), one approved reward by parent (200), one denied (150, note) for two kids → totals `{spent:240, screen_minutes:30, approved:2, declined:1}`; `kid_id` filter narrows rows and totals; `kind=screen_time` → 1 row with `auto` true and `decided_by_name` null; a 40-day-old row is excluded.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, full suite → PASS.
- [ ] **Step 5:** Commit `feat(rewards): request history with totals and filters`.

### Task 5: Badges — glyphs, award notes, overview, recent awards

**Files:**
- Modify: `backend/app/api/badges.py`, `backend/app/services/badges.py`, `backend/app/main.py`
- Test: `backend/tests/test_badges.py`

**Interfaces — Produces:**
- `BadgeIn.icon` / `BadgePatch.icon` use `Glyph` (Task 2). Emoji → 422.
- `AwardIn {kid_id: int, note: str ≤200 stripped | None = None}`; `give_custom(db, kid, badge, by: User, note: str | None) -> BadgeAward` sets `note` and `awarded_by_id`; kid `badge_earned` notification body = `f"{tier_name} · {note}"` when a note, else tier name. Response `{"tier": int, "tier_name": str}`.
- `badge_info` fallback for a missing custom badge icon becomes `military_tech`.
- `celebrations`: for custom badges `title` = name only and the item adds `"glyph": icon`; built-ins unchanged (emoji prefix in title, no `glyph`). Custom-badge `detail` = note when present, else tier name.
- New `overview_router = APIRouter(prefix="/api/v1/badges", tags=["badges"], dependencies=[Depends(require_parent)])`:
  - `GET /overview` → `[{key, name, description, icon, custom: bool, tiers: {"<kid_id>": tier}}]`: catalog order first (icon = catalog emoji; the frontend maps it), then active custom badges by id (`key "custom:<id>"`, icon = glyph). `tiers` only lists kids with tier ≥ 1.
  - `GET /recent?days=7` → newest first, max 50: `[{id, kid_id, kid_name, key, name, icon, custom, tier, tier_name, note, by_name | null, earned_at}]` where `earned_at` within `days`.

- [ ] **Step 1:** Tests: `test_custom_badge_glyph_only` (icon `"volunteer_activism"` ok, `"🏅"` 422), `test_award_note_and_recent` (award with note "shared her snack" → recent[0] has note, `by_name` = parent name, tier 1; kid notification body contains the note; built-in tier reached via `check_badges` shows in recent with `by_name` null), `test_overview_tiers` (two kids, one award → that badge's `tiers == {"<kid>": 1}`; 18 built-ins first), `test_custom_celebration_has_glyph` (kid `/kid/celebrations` badge item has `glyph` and a title without the glyph text).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (use `badges_for_many`-style batching; no per-row queries). **Step 4:** Run → PASS, full suite → PASS.
- [ ] **Step 5:** Commit `feat(badges): glyph-only custom badges, award notes, overview and recent awards`.

### Task 6: Chat backend — notes flag, typing, mentions, search, quick replies

**Files:**
- Create: `backend/app/services/typing.py`
- Modify: `backend/app/services/chat.py`, `backend/app/api/chat.py`, `backend/app/api/family.py`, `backend/app/schemas/lock.py` (`FamilyPatch`)
- Test: `backend/tests/test_chat.py`, `backend/tests/test_chat_extras.py` (new), `backend/tests/test_parent_api.py`

**Interfaces — Produces:**
- `services/typing.py` (module-level dict; comment that it relies on one uvicorn process): `TTL = 6.0`; `def ping(thread_id: int, user_id: int, name: str) -> None`; `def who(thread_id: int, me_id: int) -> list[str]` (names, expired entries dropped, sorted). Use `time.monotonic()`; accept an optional `now: float | None` param on both for tests.
- `POST /api/v1/chat/threads/{thread_id}/typing` → 204 (any user with access; name = `full_name or username`).
- `def members(db, thread) -> list[User]` in `services/chat.py`: active parents + (chore: `run_kid_ids(run)`; private: that kid; family: every active kid).
- `def mentioned(members: list[User], body: str | None, author_id: int) -> list[int]`: ids whose first name (first word of `full_name or username`) appears as `@name` (regex `@(\w+)`, case-insensitive), excluding `author_id`.
- `send` route: after `chat.post`, `inbox.notify(db, ids, "chat_message", f"{author_name} mentioned you", (body or "")[:120], thread_id=t.id)` when ids.
- `GET /threads/{kind}/{ref}` adds `typing: list[str]` and `members: [{id, name (first name)}]`.
- `unread()` rows add `note: bool` (chore thread whose run has `note_label`) and `glyph: str | None` (chore type glyph; reuse the runs it already loads, add `joinedload(Chore.type)`).
- `GET /api/v1/chat/search?q=` (`q` stripped, 2–100 chars else 422) → `{"thread_ids": [int]}`: distinct thread ids of `kind == "user"` messages whose body `ilike %q%` (escape `%`/`_`), newest 200 messages, filtered by `chat.can_access`.
- Family: `DEFAULT_QUICK_REPLIES = ["Looks good", "Can you redo it?", "Retake the photo"]` in `api/family.py`; `_fam_out` adds `quick_replies` (parsed JSON or defaults); `FamilyPatch.quick_replies: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]] | None = Field(None, max_length=8)`; `patch_family` stores it with `json.dumps`.

- [ ] **Step 1:** Tests in `test_chat_extras.py`: `test_typing_expires` (ping at now=0, `who` at 5 → [name], at 7 → []; own ping excluded), `test_typing_endpoint` (kid pings family thread → parent's thread GET `typing == [kid name]`), `test_mentions_only_members` (family thread "@mia @Mom thanks" by Leo → Mia and Mom get `chat_message`; a chore thread for Leo only with "@mia" → nobody; "@leo" by Leo → nobody), `test_thread_list_note_and_glyph` (kid note on a Pets run → that thread row `note` true, `glyph == "pets"`), `test_search_messages` (two threads, body "fraction help" in one → `thread_ids` == [that id]; kid can't get a private thread of a sibling; `q="a"` → 422).
- [ ] **Step 2:** Test in `test_parent_api.py`: `test_quick_replies_roundtrip` (GET defaults; PATCH 2 replies → GET returns them; 9 replies → 422; a 61-char reply → 422).
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. **Step 5:** Run → PASS; `tests/test_query_counts.py` still passes; full suite + ruff → PASS.
- [ ] **Step 6:** Commit `feat(chat): typing, mentions, message search, notes flag and quick replies`.

### Task 7: Frontend types, hooks and shared helpers

**Files:**
- Modify: `frontend/src/v2/types.ts`, `frontend/src/v2/hooks/useRewards.ts`, `frontend/src/v2/hooks/useCustomBadges.ts`, `frontend/src/v2/hooks/useChat.ts`, `frontend/src/v2/hooks/useKidRewards.ts`
- Create: `frontend/src/v2/hooks/useScreenTime.ts`, `frontend/src/v2/parent/glyphs.ts`, `frontend/src/v2/badgeGlyphs.ts`, `frontend/src/v2/manage/historyCsv.ts`
- Test: `frontend/tests/v2/rewardsHelpers.test.ts` (new)

**Interfaces — Produces:**
- Types: `Reward` adds `visible, needs_approval` (icon: `string | null` glyph); `PendingRedemption` adds `kid_balance_after`; `HistoryRow`, `History {totals, rows}`; `ScreenTime` (Task 3 GET shape) + `ScreenKid`; `BadgeOverview`, `RecentAward`; `Family` adds `quick_replies: string[]`; thread list row adds `note: boolean, glyph: string | null`; thread detail adds `typing: string[], members: {id, name}[]`; `KidRewards` adds `screen` (Task 3) and reward `needs_approval`; `KidCelebration` adds optional `glyph`.
- Hooks: `useRewards` (unchanged), `usePendingRedemptions()` (`['redemptions']`, `GET /redemptions`), `useDecideRedemption` takes `{id, approve, note?}`, `useApproveAll()`, `useRewardHistory({days, kid_id?, kind?})` (`['reward-history', …]`); `useScreenTime()`, `usePatchScreenTime()`, `useSetLimit()` (PUT), `useDeleteLimit()` — all invalidate `['screen-time']`; `useBadgeOverview()`, `useRecentAwards()`, `useAwardBadge` takes `{id, kid_id, note?}` and invalidates `['badge-overview']`, `['recent-awards']`; `useTypingPing(threadId, kid)` returns a `() => void` that POSTs at most once per 3000 ms; `useChatSearch(q, kid)` (enabled when `q.trim().length >= 2`, 300 ms debounce via `useDebouncedValue` from `@mantine/hooks`).
- `parent/glyphs.ts`: `REWARD_GLYPHS` = `movie, icecream, bedtime, restaurant, sports_esports, park, cake, toys, timer, redeem, local_pizza, payments, menu_book, shopping_bag, sports_soccer, palette, music_note, pool, pedal_bike, cookie, celebration, star` (contains every migration target from Task 1); `BADGE_GLYPHS` = `volunteer_activism, pets, star, favorite, emoji_events, psychology, sports_score, diversity_3, military_tech, verified, workspace_premium, celebration, auto_awesome, rocket_launch, school, cleaning_services, self_care, whatshot`.
- `badgeGlyphs.ts`: `BADGE_GLYPH: Record<string, string>` = `first_blood bloodtype, task_master assignment_turned_in, workhorse fitness_center, on_fire whatshot, comeback_kid replay, weekend_warrior shield, variety_pack casino, early_bird wb_twilight, speedrunner bolt, clutch gps_fixed, never_late alarm_on, stacking landscape, saver savings, big_spender shopping_bag, goal_getter emoji_events, patience_pays self_improvement, time_lord smartphone, drip checkroom`; `badgeGlyph(b: {key: string; custom: boolean; icon: string}): string` → custom: `b.icon || 'military_tech'`; built-in: `BADGE_GLYPH[b.key] ?? 'military_tech'`.
- `historyCsv.ts`: `toCsv(rows: HistoryRow[]): string` (header `date,kid,item,kind,status,points,decided_by,note`; `status` written `approved|declined|auto`; fields with `,` `"` or newline quoted, quotes doubled) and `downloadCsv(name: string, csv: string): void` (Blob + temporary `<a download>`).

- [ ] **Step 1:** Tests: `badgeGlyph` → `on_fire` → `whatshot`, unknown key → `military_tech`, custom `{icon:'pets'}` → `pets`; all 18 backend catalog keys (literal list in the test) have an entry; `toCsv` quotes `let's talk, Sat` and doubles quotes; `REWARD_GLYPHS` includes every value of the Task 1 map (literal list in the test).
- [ ] **Step 2:** Run `npx jest rewardsHelpers` → FAIL. **Step 3:** Implement. **Step 4:** PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(rewards): frontend types, hooks, glyph lists and CSV helper`.

### Task 8: Rewards — Requests and Catalogue panes

**Files:**
- Create: `frontend/src/v2/manage/RewardsNav.tsx`, `frontend/src/v2/manage/RewardsRequests.tsx`, `frontend/src/v2/manage/RewardsCatalogue.tsx`, `frontend/src/v2/manage/AffordDots.tsx`
- Modify: `frontend/src/v2/manage/KidsPage.tsx`, `frontend/src/v2/manage/RewardDetail.tsx`, `frontend/src/v2/manage/manage.css`
- Delete: `frontend/src/v2/manage/RewardsList.tsx`
- Test: `frontend/tests/v2/kidsRewards.test.tsx` (rewrite the `rewards and badges` reward tests), `frontend/tests/v2/rewardsPanes.test.tsx` (new)

Behaviour (mockup 02, Kids & chores → Rewards):
- URL: `/kids?section=rewards&item=<requests|catalogue|screen|history>` and, on catalogue, `&pick=<rewardId|new>`. Desktop with no `item` opens `requests`; phone shows the nav list. `KidsPage` treats rewards (and, in Task 10, badges) as fixed panes: skip the `firstId`/`known` id logic for those two sections. Keep `KidsPage.tsx` the router only; panes own their data.
- `RewardsNav`: four `pk-card` items with icon tile, name, sub-line, trailing badge/chip: Requests (`pending_actions`, "N waiting for you" / "Nothing waiting", lavender count badge), Catalogue (`storefront`, "N rewards · M hidden"), Screen time (`timer`, "{price} pts per 15 min", accent `On` chip / grey `Off`), History (`history`, "Last 30 days").
- `RewardsRequests`: header "Requests", chips `hourglass_top` "N waiting" (lav) and `stars` "Points paid on approve", button `done_all` **Approve all** (→ `useApproveAll`, toast "Approved N" + ", N skipped (not enough points)" when skipped). Card per request: glyph tile (reward glyph, `timer` for screen time), title, kid initial avatar + "Kid · asked 5:51 PM", math "{cost} pts" and "{balance} → {after}" (after red when < 0), **Approve** (disabled when after < 0, plus red `error` "Not enough points"), **Decline**, note input "Add a note (optional)…" sent with either action. Approve uses `withUndo` like Today. Footer button `history` **See history** → `item=history`. Empty: `EmptyState` icon `done_all` "No requests" "When a kid asks for a reward it shows up here."
- `RewardsCatalogue`: header "Catalogue", sub "What kids can spend points on. Circles show who can afford it now.", **New reward** (accent). Card grid: glyph tile, name, "{price} pts", `AffordDots` (one initial circle per kid, filled accent when balance ≥ price, outline otherwise; `aria-label` "Mia can afford it" / "Mia can't afford it yet"), hidden cards dimmed with grey `visibility_off` "Hidden" chip. Selected card outlined. Under the grid the `RewardDetail` editor for `pick`.
- `RewardDetail`: replace `EmojiPicker` with `GlyphPicker choices={REWARD_GLYPHS}`; add switches **Kids can see it** (`visible`) and **Needs approval** (`needs_approval`, hint when off: "Points come off right away and you get a ping."). Keep save/delete behaviour.
- Kid names and balances for `AffordDots` come from `useScreenTime().data.kids` (`kid_id, name, balance`; `Kid` has no balance).

- [ ] **Step 1:** Tests (`rewardsPanes.test.tsx`): request with balance 95 and cost 150 shows "95 → -55", "Not enough points" and a disabled Approve; Decline with note posts `{note}` to `/redemptions/{id}/deny`; Approve all posts `/redemptions/approve-all`; catalogue shows a Hidden chip for `visible:false` and AffordDots labels for 2 kids; editor toggling Needs approval off sends `needs_approval:false`; picking glyph `movie` sends `icon:'movie'`. Update `kidsRewards.test.tsx` reward tests to the new URLs.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Commit `feat(rewards): requests and catalogue panes with glyph editor`.

### Task 9: Rewards — Screen time and History panes; remove Settings → Screen time

**Files:**
- Create: `frontend/src/v2/manage/ScreenTimePane.tsx`, `frontend/src/v2/manage/ScreenLimits.tsx`, `frontend/src/v2/manage/RewardsHistory.tsx`
- Modify: `frontend/src/v2/manage/KidsPage.tsx`, `frontend/src/v2/manage/SettingsPage.tsx`, `frontend/src/v2/manage/FamilyCards.tsx` (delete `ScreenTimeCard`), `frontend/src/v2/parent/MorePage.tsx`, `frontend/src/v2/manage/manage.css`
- Test: `frontend/tests/v2/rewardsPanes.test.tsx`, `frontend/tests/v2/settings.test.tsx`, `frontend/tests/v2/SettingsList.test.tsx` (drop screen expectations)

Behaviour (mockup 02 Rewards → Screen time / History; erratum 1):
- `ScreenTimePane`: header "Screen time", chips On/Off (`toggle_on`/`toggle_off`, accent when on), `stars` "{price} pts = 15 min", `hourglass_bottom` "Max {n} min/day" (or "No daily max"). Two-column grid:
  - **How it works** (`tune`): switch "Kids can buy extra minutes"; Price (points per 15 min, number); Max per day (select: No max, 15…240 in 15s); switch "Approve automatically"; switch "Only during allowed hours" (hint when off: "Bought minutes work even outside allowed hours."). Save button, enabled when changed, PATCHes only changed fields.
  - **What points buy** (`calculate`): "Average chore ({avg} pts)" → minutes; one row per kid "{name} · {balance} pts" → "up to {h}h {m}m" (`floor(balance/price)*15`).
  - **Bought today** (`timer`, right "resets {reset_time as 4:00 AM}"): per kid initial + name + bar (ink on track in light, accent in dark — reuse the existing parent progress-bar class) + "{bought} / {max} min" (or "{bought} min" with no max).
  - **Per-kid limits** (`ScreenLimits`, `person`): rows "Leo — Max 30 min/day", "Sam — Not allowed until 100 pts" (both when both), edit pencil + remove ×; `add` **Add a limit** → inline form: kid select (kids without a limit), Max per day select (No max, 15…240), Minimum points (number, optional), Save/Cancel.
- `RewardsHistory`: header "History", sub "Every reward and screen-time purchase.", `download` **Export CSV** (`toCsv`/`downloadCsv`, file `rewards-history.csv`). KPI tiles: "Spent · 30 days", "Screen time bought" (`6h 15m`), "Approved", "Declined". Filter chips: All kids + one per kid; Rewards / Screen time (toggle; none = both). Rows: initial avatar, name, sub "Kid · Today 5:12 PM · auto-approved | approved by {name} | declined by {name}" + ` · “note”` when present; chip `Auto` (lav, `bolt`), `Approved` (acc, `check`), `Declined` (grey, `close`); amount `−{cost}` (or `0` when declined). Empty: `EmptyState` `history` "Nothing yet".
- Settings: remove the `screen` section from `SETTINGS_SECTIONS` and `MorePage`; `/settings?section=screen` → `router.replace('/kids?section=rewards&item=screen')`. Remove `ScreenTimeCard` and its InfoBlock.

- [ ] **Step 1:** Tests: screen pane toggling Approve automatically and Save PATCHes `{auto_approve:true}` only; bought-today row "30 / 60 min"; Add a limit for Sam with min 100 PUTs `/screen-time/limits/{sam}` `{max_minutes:null, min_points:100}` and the row reads "Not allowed until 100 pts"; history kid filter refetches with `kid_id`; Export CSV calls `downloadCsv` with a header line; Settings list no longer has "Screen time" and `/settings?section=screen` redirects.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Demo check (see Task 13 rules): compare Requests, Catalogue, Screen time, History at 1280 and 390 wide, light and dark, with mockup 02; fix drift.
- [ ] **Step 6:** Commit `feat(rewards): screen time and history panes under Rewards`.

### Task 10: Badges — All badges, Custom badges, Recent awards

**Files:**
- Create: `frontend/src/v2/manage/BadgesNav.tsx`, `frontend/src/v2/manage/BadgesAll.tsx`, `frontend/src/v2/manage/BadgesCustom.tsx`, `frontend/src/v2/manage/BadgesRecent.tsx`, `frontend/src/v2/manage/TierPips.tsx`
- Modify: `frontend/src/v2/manage/KidsPage.tsx`, `frontend/src/v2/manage/BadgeDetail.tsx`, `frontend/src/v2/manage/manage.css`
- Delete: `frontend/src/v2/manage/BadgesList.tsx`
- Test: `frontend/tests/v2/kidsRewards.test.tsx` (badge tests), `frontend/tests/v2/badgesPanes.test.tsx` (new)

Behaviour (mockup 02, Kids & chores → Badges):
- URL `/kids?section=badges&item=<all|custom|recent>` (+ `&pick=<badgeId|new>` on custom). Desktop default `all`.
- `BadgesNav`: All badges (`military_tech`, "Who has what, by tier"), Custom badges (`auto_awesome`, "N made by you · award one"), Recent awards (`celebration`, "N this week", count badge).
- `TierPips({tier})`: five pips classed `t1…t5` filled up to `tier`, with tier colours Copper → Silver → Gold → Platinum → Mega-diamond (reuse `src/v2/tiers.ts` names), `aria-label` "{Tier}" or "Not earned".
- `BadgesAll`: header "Badges", chips "{n} built-in", "{n} custom", "{n} new this week"; tier legend; card per overview item: glyph tile (`badgeGlyph`), name, description, one row per kid: initial, `TierPips`, tier name. Custom ones get a lav `Custom` chip.
- `BadgesCustom`: header "Custom badges", sub "Your own badges. Each award moves that kid up a tier.", **New badge**; grid of custom badge cards (same card as All); below, two columns: the editor (`BadgeDetail`, `GlyphPicker choices={BADGE_GLYPHS}`) and **Award it**: kid picker, preview row "{Kid} goes {Gold} → **{Platinum}**" (or "{Kid} gets **Copper**" at 0; at 5 disable Award with "Already Mega-diamond"), "Note to {Kid} (optional)" input (≤200), button `military_tech` "Award to {Kid}" → `useAwardBadge({id, kid_id, note})`, toast "{Badge}: {Tier}".
- `BadgesRecent`: header "Recent awards", sub "Earned automatically or given by a parent."; rows: glyph tile, "{Kid} reached {Badge} · {Tier}" (built-in) or "{Kid} got {Badge} · {Tier}" (custom), sub "Given by {by_name} · “{note}” · {when}" or "{when}", `TierPips`. Empty: `EmptyState` `celebration` "No awards this week".

- [ ] **Step 1:** Tests: All shows `whatshot` for `on_fire` and 5 pips with 2 filled for a Silver kid; Award preview "Mia goes Gold → Platinum" and posts `{kid_id, note}`; a kid at tier 5 disables Award; Recent renders "Given by Mom · “shared her snack”"; New badge sends a glyph icon.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Demo check against mockup 02 Badges (1280/390, light/dark); fix drift.
- [ ] **Step 6:** Commit `feat(badges): all badges, custom badges with award notes, recent awards`.

### Task 11: Chat — Notes tab, typing, mentions, search, quick replies

**Files:**
- Create: `frontend/src/v2/chat/QuickReplies.tsx`, `frontend/src/v2/chat/QuickRepliesEditor.tsx`, `frontend/src/v2/chat/MentionMenu.tsx`, `frontend/src/v2/chat/TypingLine.tsx`, `frontend/src/v2/chat/mentions.tsx`
- Modify: `frontend/src/v2/chat/ThreadList.tsx`, `frontend/src/v2/chat/ThreadView.tsx`, `frontend/src/v2/chat/ThreadHead.tsx`, `frontend/src/v2/chat/ParentBubble.tsx`, `frontend/src/v2/chat/chatDock.css`
- Test: `frontend/tests/v2/chatExtras.test.tsx` (new), `frontend/tests/v2/chat.test.tsx` (tabs)

Behaviour (mockup 02 Chat):
- `ThreadList`: tabs **All · Chores · N · Notes · N · Family** (Notes = `t.note`; remove the ponytail comment); a Notes row shows an amber `flag` "Note" chip. Chore rows use `t.glyph` for the tile when present. Search: a thread matches when the existing title/last-text match **or** its id is in `useChatSearch(search).data.thread_ids`.
- `ThreadHead` tile uses the thread glyph when given (fallback `choreIcon(title)`).
- `TypingLine({names})`: three dots + "Mia is typing…" / "Mia and Leo are typing…" / "3 people are typing…"; `aria-live="polite"`; rendered at the bottom of the message list when `data.typing.length`.
- Composer (`ThreadView`): on input change with non-empty text call the `useTypingPing` function. Parent composer only: `alternate_email` icon button inserts `@` at the caret and opens `MentionMenu`; typing `@` + letters also opens it, filtered by `data.members`; Enter/click inserts `@Name ` ; Esc closes. Menu uses the solid popover card style (2px ink border, sticker shadow).
- `mentions.tsx`: `renderMentions(body: string, names: string[]): ReactNode[]` wraps `@Name` tokens whose name is in `names` (case-insensitive) in `<b className="pc-mention">`. `ParentBubble` (and the kid bubble if it shares the renderer) uses it.
- `QuickReplies({threadId, run})` (parent only, above the composer): first chip (accent, `check`) **Approve + “Great job!”** only when `run?.state === 'needs_you'` → `withUndo(async () => { await approve(run.id); await post({threadId, body: 'Great job!'}) }, \`Approved +${run.points}\`)`; then one chip per `family.quick_replies` → posts that text; last chip `edit` **Edit replies** → `QuickRepliesEditor` (Mantine `Modal`: list with ↑/↓/remove, add input, max 8, each ≤60, Save → `usePatchFamily({quick_replies})`, toast "Saved").
- Keep `ThreadView.tsx` under 400 lines by putting new logic in the new files.

- [ ] **Step 1:** Tests: Notes tab lists only `note:true` threads with the count; search "fraction" shows a thread returned by the search API even though its title doesn't match; `TypingLine` texts for 1, 2, 3 names; typing in the composer POSTs `/typing` once for several keystrokes within 3 s (jest fake timers); `@` button opens the menu and picking "Mia" yields composer text "@Mia "; `renderMentions('hi @mia', ['Mia'])` wraps `@mia`; tapping "Looks good" posts it; Approve + Great job calls approve then posts "Great job!" (after the undo delay); the chip is absent when `run.state` is `todo`; editor Save PATCHes `/family` with the edited list.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Demo check against mockup 02 Chat at 1280/390; fix drift.
- [ ] **Step 6:** Commit `feat(chat): notes tab, typing, mentions, message search and quick replies`.

### Task 12: Kid screens — reward glyphs, instant rewards, screen-time limits, badge glyphs

**Files:**
- Modify: `frontend/src/v2/kid/RewardsSection.tsx`, `frontend/src/v2/components/BadgeGrid.tsx`, `frontend/src/v2/kid/AwardOverlay.tsx`
- Test: `frontend/tests/v2/kidRewards.test.tsx`

Behaviour (fridge look kept; Plan C restyles layout):
- Rewards: icon via `Icon name={r.icon ?? 'redeem'}` (sized for the fridge card, `aria-hidden`). `needs_approval:false` → button **Get it** and, on a response with `status === 'approved'`, inline "It's yours!" (`f-pill` tone ok); otherwise **Request** as today.
- Screen time (from `screen`): minute options capped at `left_today` when not null; line "{bought_today} of {max_today} min today" when `max_today` not null; disabled with the server's wording when `left_today === 0` ("You've had all your screen time for today."), when `balance < min_points` ("You can buy screen time once you have {n} points."), or when `screen.only_in_hours && !screen.in_hours` ("Screen time only works during your allowed hours."). Button text **Get screen time** when `screen.auto`, else **Request screen time**. Show the server `detail` on a 409.
- `BadgeGrid`: `b.custom ? <Icon name={b.icon} …/> : b.icon` (built-in emojis stay).
- `AwardOverlay`: when `award.glyph` is set render the glyph `Icon` above the title.

- [ ] **Step 1:** Tests: reward `icon:'movie'` renders the glyph, not the text "movie" as a label; Get it on an approval-off reward shows "It's yours!"; `left_today: 15` limits the select to 15; `left_today: 0` shows the all-used text and disables the button; custom badge renders an `Icon`, built-in renders its emoji; overlay with `glyph` shows it.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; jest full, tsc, lint.
- [ ] **Step 5:** Commit `feat(kid): reward glyphs, instant rewards, screen-time limits and badge glyphs`.

### Task 13: End-to-end and demo pass

**Files:**
- Create: `frontend/e2e/rewards.spec.ts` (follow `chore-model.spec.ts` for login helpers and seed use)
- Test: `scripts/lab.sh e2e`

- [ ] **Step 1:** Spec: parent sets screen time (price 20, max 30/day, auto-approve on) under Kids & chores → Rewards → Screen time; adds a reward with Needs approval off; kid (with enough points) gets the reward instantly and buys 30 min (auto-approved), then can't buy more today; parent sees both in History with `Auto`; parent awards a custom badge with a note and sees it in Recent awards; parent types in a family chat, picks `@Kid` from the menu, sends a quick reply, and finds the thread by message search.
- [ ] **Step 2:** `scripts/lab.sh e2e` → all pass (no new skips).
- [ ] **Step 3:** Demo: the live demo backend reloads from this checkout, so it needs the Task 1 migration on its database. **Ask the controller before running `alembic upgrade head` against the demo `DATA_DIR`**; never restart the servers. Then click through every new surface light/dark/phone, compare with mockup 02, axe 0 serious/critical.
- [ ] **Step 4:** Commit `test(e2e): rewards, screen time, badges and chat flow`.
