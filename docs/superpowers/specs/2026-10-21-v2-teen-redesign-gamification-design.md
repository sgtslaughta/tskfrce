# t@sk4ce v2: teen redesign + gamification

Date: 2026-10-21. Status: approved by owner 2026-10-21.
Mockups (visual reference, not committed): `tskfrce-blocker/.superpowers/brainstorm/3658153-1792603322/content/` — `theme-final.html`, `controls.html`, `levels-flair.html`.

## Why

The app is used by older kids and teens. The current "fridge chart" look (Fredoka/Nunito, thick outlines, hard offset shadows, sticker styling) reads childish. The owner likes the colors and wants a mature, polished look. Separately, the legacy app's gamification was mostly a shell (tables and endpoints, nothing awarding anything); the owner wants a real reward loop that motivates teens: earn points, spend them on screen time or parent-defined rewards, level up, collect flair, show off to siblings.

## Goals

- Teen-appropriate look across every v2 screen (parent and kid), light and dark.
- Points that are earned automatically and spent with parent approval.
- Progression to show off: levels with titles, streaks, tiered badges, weekly family leaderboard, collectible animated name cards and flair.
- Celebration moments that feel exciting (award screen, level up, badge tier).

## Non-goals

- No change to the network blocker or lock rules beyond creating bonus overrides for approved screen time.
- No legacy (`/hub`) screens restyled or revived.
- No real-money or purchases. No cross-family/global leaderboards.
- No sounds (not requested).

## Anti-goals (failure even if it works)

- Looks like a kids' sticker book, or like a stock component library ("stock" inputs/buttons were called out).
- Kids can spend points or get screen time without a parent approving.
- Spending points lowers a kid's level.
- The app asks or stores a kid's gender, or limits flair by gender.
- A late parent approval costs a kid their streak or early bonus.

## Constraints

- Stack stays: Next.js (pages router) + Mantine + TanStack Query frontend in `frontend/src/v2`; FastAPI + SQLAlchemy + SQLite + Alembic backend. No new heavy dependencies; CSS animations preferred over animation libraries.
- CI must pass: backend `ruff format --check`, `ruff check`, `pytest`; frontend `npm run lint`, `npm run type-check`, jest.
- Files under ~500 lines.
- Accessibility basics: contrast in both modes, focus states visible, animations respect `prefers-reduced-motion`.

## Delivery: four projects, in order

Each ships on its own, gets its own implementation plan, and is merged before the next starts.

### 1. New look (no behavior change)

Decided by the owner via mockups:

- **Fonts:** Space Grotesk (headings, names, numbers in UI chrome, buttons), Inter (body). JetBrains Mono for point/XP numbers (Claude's call; owner approved the mockup showing it). Replace Fredoka/Nunito in `src/v2/fonts.ts`, `pages/_app.tsx`, `src/v2/theme.ts`, `src/v2/fridge.css`.
- **Colors:** keep palette — navy `#1d2b53`, sun `#ffc93c`, red `#ff6b4a`, green `#7bd389`. Use color as accents, not fills everywhere.
- **Cards:** no outlines, soft shadow, 8px corners. Kid cards are two-tone: header + body.
  - Light: page `#f4f7fa`; card header navy with white text, yellow points, yellow-gradient XP bar; body white.
  - Dark: page neutral charcoal `#1e2026`; card header pale `#e8eeff` with navy text, a 4px yellow top stripe, yellow XP bar; card body stays navy `#18213f`.
- **Background:** faint square grid (24px) in both modes, masked to fade from top to bottom (`theme-final.html` has the exact CSS).
- **Type details:** uppercase letter-spaced small labels, nav links, tags, buttons. Active nav item underlined in yellow.
- **Controls: "gamer-cut"** (`controls.html` option C): outlined fields, 4px radius; focus = strong border + yellow 3px offset shadow. Primary button yellow and secondary button tinted, both with cut corners (clip-path). Segmented controls with filled active segment. Toggle switches green when on. Danger actions as red text buttons. Apply to every input, select, button, segmented control and switch in v2 (Mantine theme overrides + CSS).
- Remove sticker visuals (`Sticker.tsx`, `StickerCard.tsx`) or restyle them to the new card system — builder's call per screen.
- Rename the "fridge" naming (`fridge.css`, `FridgeShell`, `.f-*`) only if cheap; not required.

### 2. Points economy

Owner decisions:

- **Earning:** a chore's points are awarded automatically when a parent approves it (creates a `Points` row, type `task_completion`). Today nothing awards points; this is the missing link.
- **Deadlines + early bonus:** parents can set a due time on a chore. Finishing by the deadline or early earns bonus points, capped; **parents set the cap** (family setting). Timing is judged by when the kid **marked it done** (`Task.submitted_for_approval_at`), not approval time. Bonus formula is the builder's call within the cap (keep it simple, e.g. flat bonus for on time, bigger for early).
- **Balance:** spendable points = sum of `Points.amount` (already exposed as `points_balance`).
- **Spending, always parent-approved; nothing is deducted until approval; a denied or ignored request costs nothing:**
  1. **Screen time:** kid requests N minutes. Price set by parents (family setting, e.g. points per 15 minutes — Claude's call on the unit). On approval: deduct points, create a `bonus` `Override` for that kid's devices for that duration. This replaces/powers the existing "Points can unlock early" setting (`FamilySettings.points_unlock_early`, `Override.source='bonus'`, `lock/rules.py`).
  2. **Custom rewards:** parents create rewards (name, point price, optional image). A family can have several. Kid sees each with a progress bar toward the price, requests it when affordable, parent approves, points are deducted.
- **Requests reach parents as notifications** with one-tap approve/deny.
- **Award screen:** on approval of a custom reward the kid sees an exciting animated award page. Screen time gets a smaller celebration (Claude's call).

### 3. Progression

Owner decisions:

- **Levels** count **lifetime points earned** (never reduced by spending; bonus points count; penalties — builder's call, default: don't reduce XP). Each level has a title. Draft ladder approved: Lv1 Rookie, Lv3 Regular, Lv5 Grinder, Lv8 Clutch, Lv12 Elite, Lv16 Veteran, Lv20 Legend, Lv25 Mythic. XP curve is the builder's call (gentle early, steeper later; reaching Lv25 should take many months of normal chores).
- **Streaks:** a streak day = all of that day's chores done and approved. Days with no chores assigned pause the streak (don't break it). Done-time, not approval time, decides the day.
- **Badges:** built-in set plus parent-created custom badges.
  - Re-earning a badge upgrades its tier: **copper → silver → gold → platinum → mega-diamond.** Each built-in badge defines its own thresholds per tier.
  - Custom parent badges are awarded manually by the parent (Claude's call; they have no rule to evaluate). Tiers for custom badges: each manual award moves up one tier (Claude's call).
  - Built-in list: Task Master (20 chores), Big Spender (cash in points), First Blood (first approved chore), Centurion (100 chores), Workhorse (10 chores in a week), Clean Sweep (all chores 7 days straight), Weekend Warrior (all weekend chores 4 weekends straight), Variety Pack (10 different chores), Early Bird (10 early finishes), Speedrunner (done within 15 min of assignment), Clutch (done in last 10 min before deadline), Never Late (30 on-time in a row), On Fire (7-day streak), Unstoppable (30-day), Iron Will (100-day), Comeback Kid (new 7-day streak after a break), Stacking (1,000 lifetime points), Saver (hold 500 unspent), Goal Getter (first custom reward), Patience Pays (redeem a 2,000+ reward), Time Lord (10 approved screen-time requests), Drip (equip flair for the first time). Where a badge is naturally a ladder (On Fire / Unstoppable / Iron Will), the builder may merge into one tiered badge.
- **Visibility:** siblings can see each other's profiles (level, title, badges, flair).
- **Family leaderboard:** weekly ranking, resets each week. Ranks by points earned that week including bonuses; spending doesn't count (Claude's call; owner approved weekly rankings).
- **Celebrations:** level up, new badge or badge tier, reward approved — each gets a celebration screen, scaled to the moment.
- Reuse existing backend pieces where they fit (`backend/app/models/gamification.py`, `services/gamification_service.py`, `api/gamification.py`: Points, Achievement/UserAchievement, Streak, Leaderboard). They're mounted but unused and partly mismatched with the legacy frontend; reshape freely, legacy frontend compatibility is not required.

### 4. Flair

Owner decisions:

- Each level tier unlocks a **set** of animated name cards and flair items, in the spirit of CS:GO / Steam profile name cards.
- Themes include unicorns, crowns, ninja gear, and more. **Every set mixes styles; any kid can equip anything they've unlocked. No gender field, no gender filtering.**
- Flair shown in the levels mockup (title tag color, avatar ring, name color, card banner, glowing ring, gold name, animated card) is the progression direction.
- **Customization area** for kids: browse collection (locked items visible with unlock level), equip one name card and flair, preview live.
- Equipped flair shows wherever the kid's identity appears (kid home, sibling profiles, leaderboard, parent Today cards).
- Art: CSS/SVG-based animations (no asset pipeline needed). Catalog size per tier is the builder's call (suggest 3–5 items per tier).

## Left to the builder

- Data model and API shape for rewards, requests, badges tiers, flair catalog/equips, XP curve.
- Whether to store flair catalog in code or DB (code is simpler; owner hasn't asked for parent-editable flair).
- Screen layouts for kid profile, leaderboard, rewards list, customization area, parent approval inbox — follow the approved theme.
- Bonus formula within the parent cap; screen-time price unit.

## Open (Claude's calls, flagged for owner)

- Base branch: build on top of `feat/v2-hardening` (has the BlockerBanner in `FridgeShell` and is unmerged) to avoid conflicts. Rebase if it merges first.
- JetBrains Mono for numbers.
- Leaderboard metric: weekly points earned.
- Custom badges awarded manually; each award = next tier.
