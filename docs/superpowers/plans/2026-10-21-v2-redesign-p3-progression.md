# v2 Redesign Project 3: Progression — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levels with titles, streaks, tiered badges (built-in + parent-made), a weekly family leaderboard, sibling profiles, and celebration screens for level-ups and badge tiers.

**Architecture:** Everything derivable is computed from existing data (points ledger, chore instances, redemptions) in one service, `app/services/progression.py`; only facts that can't be recomputed are stored: earned badge tiers (`badge_awards`), parent-made badges (`custom_badges`), and the last level a kid has been celebrated for (`users.celebrated_level`). The built-in badge catalog is code. Badge checks run after the two events that change metrics: chore approval and redemption approval. The Project 2 award overlay is generalized into one celebration feed.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, SQLite, pytest; Next.js + Mantine + TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-10-21-v2-teen-redesign-gamification-design.md` (section "3. Progression"). Mockup: `docs/superpowers/specs/2026-10-21-v2-teen-redesign-mockups/levels-flair.html` (ladder + title tags), `theme-final.html` (kid card header with level, XP bar, streak).

Prerequisite: Projects 1 and 2 merged into `feat/v2-teen-redesign`. Same commands as the Project 2 plan.

## Global Constraints

- **XP = lifetime points earned** = sum of `Points.amount` where `amount > 0` and `points_type` not in (`REDEMPTION`, `TRANSFER`). Spending and penalties never lower XP or level.
- **Level curve** (Claude's call): XP needed to reach level `n` = `round(50 * (n - 1) ** 1.6)` (Lv1 = 0, Lv2 = 50, Lv8 ≈ 1126, Lv25 ≈ 8100 ≈ 9–10 months of ~30 points/day). No level cap.
- **Titles** (owner-approved): Lv1 Rookie, Lv3 Regular, Lv5 Grinder, Lv8 Clutch, Lv12 Elite, Lv16 Veteran, Lv20 Legend, Lv25 Mythic. A level's title = highest entry ≤ level.
- **Streak day** = a chore day (instance `due_date`) where every non-cancelled instance assigned to the kid is `DONE` or `SUBMITTED_FOR_APPROVAL` (a late approval must not break a streak). Days with **no** instances are skipped (pause, don't break). Today counts if already complete and never breaks the streak while still open. Look back at most 400 chore days.
- **Badge tiers:** `copper → silver → gold → platinum → mega-diamond` (tier 1–5). A badge's tier = number of its thresholds met. Single-threshold badges have only tier 1.
- **Built-in catalog** (key, name, metric, thresholds). Merges the spec allows/implies are applied (Centurion → Task Master tiers; Clean Sweep, Unstoppable, Iron Will → On Fire tiers):

| key | name | metric | thresholds |
|---|---|---|---|
| `first_blood` | First Blood | chores approved | 1 |
| `task_master` | Task Master | chores approved | 20, 50, 100, 250, 500 |
| `workhorse` | Workhorse | best ISO week, chores approved | 10, 15, 20, 30, 40 |
| `on_fire` | On Fire | longest streak (days) | 7, 30, 60, 100, 365 |
| `comeback_kid` | Comeback Kid | 7+ day streaks that came after an earlier broken streak | 1, 3, 5, 10, 20 |
| `weekend_warrior` | Weekend Warrior | longest run of consecutive weekends with every Sat/Sun chore complete (weekends with no chores skipped) | 4, 8, 12, 26, 52 |
| `variety_pack` | Variety Pack | distinct chore definitions (`parent_task_id`) approved | 10, 20, 30, 40, 50 |
| `early_bird` | Early Bird | chores done ≥ 60 min before their deadline | 10, 25, 50, 100, 250 |
| `speedrunner` | Speedrunner | chores done within 15 min of the instance `created_at` | 1, 5, 10, 25, 50 |
| `clutch` | Clutch | chores done in the last 10 min before their deadline | 1, 5, 10, 25, 50 |
| `never_late` | Never Late | longest run of consecutive deadline chores done on time | 30, 60, 100, 200, 365 |
| `stacking` | Stacking | XP | 1000, 2500, 5000, 10000, 25000 |
| `saver` | Saver | current balance at check time | 500, 1000, 2000, 5000, 10000 |
| `big_spender` | Big Spender | approved redemptions (any kind) | 1, 5, 10, 25, 50 |
| `goal_getter` | Goal Getter | approved reward redemptions | 1, 3, 5, 10, 20 |
| `patience_pays` | Patience Pays | approved reward redemptions with cost ≥ 2000 | 1, 2, 3, 5, 10 |
| `time_lord` | Time Lord | approved screen-time redemptions | 10, 25, 50, 100, 250 |

  `Drip` (equip flair) belongs to Project 4. Deadline/"done" times use `Task.submitted_for_approval_at` and `economy.deadline_utc` from Project 2.
- **Custom badges:** parent creates `{name (1–60), icon (emoji ≤ 8), description (≤ 200)}`; parent taps Award → that kid's tier +1 (max 5). Custom badges show alongside built-ins.
- **Leaderboard:** weekly, Monday 00:00 → next Monday in family timezone; score = sum of positive non-`REDEMPTION`/`TRANSFER` points created that week. Ties share a rank. All kids listed, including 0.
- **Visibility:** kids see siblings' name, avatar, level, title, current streak, badges, leaderboard. Never siblings' balance, chores, devices or requests.
- **Celebrations:** level-up and each new badge tier create a celebration; reward/screen-time from Project 2 join the same feed. Bigger moments = bigger animation (level-up and gold+ tiers big; copper/silver small). Reduced motion respected.
- New migration revises Project 2's last migration (`f6a7b8c9d0e1`).
- Files < 500 lines; split the badge catalog/metrics into `app/services/badges.py` if `progression.py` grows past that.

## Review Focus

1. **Spending lowers level:** a kid at Lv5 spends most of their balance → still Lv5. (Task 1 test.)
2. **Late approval breaks streak:** chores submitted on their day, approved two days later → streak intact. (Task 1 test.)
3. **No-chore days:** a weekend with no chores between two complete weeks → streak continues across it. (Task 1 test.)
4. **Badge re-award:** running `check_badges` twice with no metric change awards nothing new and creates no duplicate celebration. (Task 2 test.)
5. **Kid privacy:** a kid token calling the siblings endpoint never receives `points_balance`, chores or devices of a sibling. (Task 3 test.)

---

### Task 1: XP, levels, streaks

**Files:**
- Create: `backend/app/services/progression.py`
- Modify: `backend/app/api/kid.py` `today` and `backend/app/api/family.py` `today` (add `progress` per kid)
- Test: `backend/tests/test_progression.py`

**Interfaces:**
- `xp(db, kid_id: int) -> int`
- `xp_for_level(n: int) -> int`
- `level_for(xp: int) -> Level` — `@dataclass(frozen=True) Level(level: int, title: str, xp: int, floor: int, next: int)` (`floor` = XP at this level, `next` = XP for level+1).
- `streak(db, kid_id: int, today: date) -> Streak` — `Streak(current: int, longest: int, runs: list[int])` (`runs` = completed run lengths in chronological order, used by Comeback Kid).
- `progress(db, kid: User, fam: FamilySettings) -> dict` → `{"level", "title", "xp", "floor", "next", "streak"}` (JSON for both today endpoints, key `progress`).

- [ ] **Step 1: Failing tests:** `xp_for_level` 1 → 0, 2 → 50, 25 → `round(50*24**1.6)`; `level_for` titles at Lv1/2/3/7/8/25/30 (Rookie, Rookie, Regular, Grinder, Clutch, Mythic, Mythic); **XP ignores REDEMPTION rows, level unchanged after spending**; streak: 3 complete days → 3; a day with one TODO chore breaks it; **submitted-not-approved days count**; **no-chore days skipped**; today incomplete doesn't break; `runs` lists earlier broken runs; `/kid/today` and parent `/today` carry `progress`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Streak: one query for the kid's chore instances in the last 400 days, group by `due_date.date()`, walk back from today.
- [ ] **Step 4: Run backend suite + ruff, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): xp, levels and streaks`

---

### Task 2: Badges (built-in + custom) and celebration feed

**Files:**
- Create: `backend/app/services/badges.py` (catalog, `metrics`, `check_badges`)
- Create: `backend/app/models/badge.py` (`BadgeAward`, `CustomBadge`)
- Create: `backend/app/api/badges.py` (parent custom-badge routes)
- Create: `backend/alembic/versions/a1b2c3d4e5f6_badges_and_celebrations.py` (tables + `users.celebrated_level INTEGER NOT NULL DEFAULT 1`)
- Modify: `backend/app/api/chores.py` `approve` and `backend/app/services/economy.py` `decide` (call `check_badges` before commit)
- Modify: Project 2 kid awards routes → celebration feed (see Interfaces)
- Modify: `backend/app/main.py` (mount)
- Test: `backend/tests/test_badges.py`

**Interfaces:**
- `CATALOG: dict[str, BadgeDef]` — `BadgeDef(key, name, icon, description, metric: str, thresholds: tuple[int, ...])`, icons are emoji (builder picks).
- `TIERS = ("copper", "silver", "gold", "platinum", "mega-diamond")`
- `metrics(db, kid: User, fam: FamilySettings) -> dict[str, int]` — keys = the metric names used in `CATALOG`.
- `check_badges(db, kid: User, fam: FamilySettings) -> list[BadgeAward]` — upserts new tiers only; caller commits.
- `BadgeAward`: `id`, `kid_id`, `badge_key String(40)` (built-in key or `"custom:<id>"`), `tier Integer`, `earned_at`, `seen_by_kid Boolean default False`; unique (`kid_id`, `badge_key`) — a tier-up updates the row and resets `seen_by_kid=False`.
- `CustomBadge`: `id`, `name String(60)`, `icon String(8)`, `description String(200)`, `active Boolean`, `created_at`.
- Parent routes: `GET/POST /custom-badges`, `PATCH/DELETE /custom-badges/{id}` (soft delete), `POST /custom-badges/{id}/award` body `{kid_id}` → `{tier}` (409 "Already at mega-diamond." at 5).
- `badges_for(db, kid_id) -> list[dict]` → `[{key, name, icon, description, tier, tier_name, custom}]` (earned only).
- **Celebration feed** (replaces Project 2's `/kid/awards` shape): `GET /kid/celebrations` → `[{key: str, kind: "reward"|"screen_time"|"badge"|"level", title: str, detail: str, size: "big"|"small"}]`, oldest first; `POST /kid/celebrations/{key}/seen` → 204. Keys: `r:<redemption id>`, `b:<award id>`, `l:<level>`. Level celebration appears when current level > `users.celebrated_level`; marking it seen sets `celebrated_level` to current. Size: level and reward = big; badge tier ≥ 3 big else small; screen time small. Keep `/kid/awards` as an alias only if Project 2's frontend still calls it, otherwise update that frontend call in this task.

- [ ] **Step 1: Failing tests:** each metric on a small fixture (approve 20 chores → `task_master` tier 1 and `first_blood`; 50 → tier 2); `on_fire` from a 7-day streak; **second `check_badges` with no change → empty list, still one row**; tier-up resets `seen_by_kid`; custom badge award goes 1→5 then 409; kid token → 403 on custom badge routes; celebration feed returns level-up after XP crosses Lv2, `seen` stops it; feed includes a Project 2 approved reward.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Metrics read chore instances, ledger and redemptions with a handful of queries; no per-day query loops.
- [ ] **Step 4: Run backend suite + ruff + `test_migrations.py`, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): tiered badges and celebration feed`

---

### Task 3: Leaderboard and sibling profiles

**Files:**
- Modify: `backend/app/services/progression.py` (`leaderboard`)
- Create: `backend/app/api/community.py` (routes usable by parent and kid tokens)
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_community.py`

**Interfaces:**
- `leaderboard(db, fam, now_utc: datetime) -> dict` → `{"week_start": "YYYY-MM-DD", "rows": [{kid_id, name, avatar, score, rank, level, title}]}` sorted by score desc then name.
- Routes (any authenticated parent or kid of this family): `GET /api/v1/leaderboard`; `GET /api/v1/profiles` → `[{kid_id, name, avatar, level, title, streak, badges}]` (badges from `badges_for`); `GET /api/v1/profiles/{kid_id}` → one. Use the app's existing current-user dependency; reject other roles with 403.

- [ ] **Step 1: Failing tests:** week boundary (points Sunday 23:30 local count for the old week, Monday 00:10 local for the new one, tz `America/Chicago`); spending doesn't reduce score; ties share rank; kid sees siblings; **profile JSON has no `points_balance`, `chores`, `devices`, `requests` keys**; unauthenticated → 401.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run backend suite + ruff, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): weekly leaderboard and sibling profiles`

---

### Task 4: Frontend — level, streak, leaderboard, profiles

**Files:**
- Modify: `frontend/src/v2/types.ts` (`Progress`, `Badge`, `LeaderboardRow`, `Profile`)
- Create: `frontend/src/v2/components/ProgressHeader.tsx` (name, `Lv N · Title` tag, XP bar `aria-valuenow`, streak "N day streak"; used inside `.f-card-head`)
- Create: `frontend/src/v2/components/Leaderboard.tsx`, `frontend/src/v2/components/ProfileModal.tsx`, `frontend/src/v2/components/BadgeGrid.tsx` (tier color ring per tier: copper `#b87333`, silver `#c0c7d1`, gold `#ffc93c`, platinum `#9fe3e0`, mega-diamond animated gradient `#7bd3ff → #c58bff → #ff9ad5`)
- Create: `frontend/src/v2/hooks/useCommunity.ts` (`useLeaderboard`, `useProfiles`, `useProfile`; kid variant passes `kid: true`)
- Modify: `frontend/src/v2/today/KidCard.tsx` (ProgressHeader), `frontend/src/v2/today/TodayPage.tsx` (Leaderboard below the cards), `frontend/src/v2/kid/KidPage.tsx` (ProgressHeader on top; "Family" section: leaderboard + sibling cards opening ProfileModal)
- Test: `frontend/tests/v2/progression.test.tsx`

- [ ] **Step 1: Failing tests:** ProgressHeader shows "Lv 8 · Clutch", XP bar `aria-valuenow` = `round((xp-floor)/(next-floor)*100)`, "12 day streak"; Leaderboard renders rows in rank order and marks ties; ProfileModal lists badges with tier names; kid page shows siblings and opens a profile.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with Project 1 classes (`.f-card-head`, `.f-num`, `.f-cap`); mega-diamond animation off under reduced motion.
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): levels, streaks, leaderboard and profiles`

---

### Task 5: Frontend — custom badges and celebrations

**Files:**
- Create: `frontend/src/v2/manage/CustomBadgesPanel.tsx` (create/edit/delete; "Award" picks a kid; mount on `KidsPage.tsx`)
- Modify: Project 2's `frontend/src/v2/kid/AwardOverlay.tsx`, `award.css`, `frontend/src/v2/hooks/useKidRewards.ts` → consume `/kid/celebrations` (big vs small by `size`; level-up shows new title; badge shows tier color ring from `BadgeGrid`)
- Test: `frontend/tests/v2/customBadges.test.tsx`, update `frontend/tests/v2/kidRewards.test.tsx`

- [ ] **Step 1: Failing tests:** create custom badge posts `{name, icon, description}`; Award posts `/custom-badges/3/award {kid_id: 1}` and toasts the new tier name; overlay renders a level celebration "Level 8 · Clutch" and a small badge celebration; dismiss posts `/kid/celebrations/l:8/seen` (URL-encode the key).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): custom badges and celebration screens`
