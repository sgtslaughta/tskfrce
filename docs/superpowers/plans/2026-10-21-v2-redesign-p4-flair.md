# v2 Redesign Project 4: Flair — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kids unlock animated name cards and flair by level, equip them in a customization area ("Locker") with live preview, and their equipped look shows everywhere their identity appears.

**Architecture:** The flair catalog is code in the backend (`app/flair/catalog.py`: id, slot, name, unlock level, theme) and is served to the frontend; the frontend renders each id with a CSS class `.flair-<id>` in one stylesheet. Equipped items are one JSON column on `users`. One `NameCard` component renders a kid's identity with their flair and replaces ad-hoc name rendering.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest; Next.js + Mantine + TanStack Query, Jest; CSS animations only.

**Spec:** `docs/superpowers/specs/2026-10-21-v2-teen-redesign-gamification-design.md` (section "4. Flair"). Mockup: `docs/superpowers/specs/2026-10-21-v2-teen-redesign-mockups/levels-flair.html` (Rookie → Clutch → Legend progression, sheen animation CSS).

Prerequisite: Projects 1, 2, 5a and 3 merged into `feat/v2-teen-redesign`. Same commands as the Project 2 plan.

## Global Constraints

- **No gender anywhere:** no gender field, filter, tag or copy. Every kid can equip anything they've unlocked. Themes mix styles in every tier.
- **Slots:** `card` (animated name-card background), `ring` (avatar ring), `name` (name color/effect), `emblem` (icon beside the name), `title` (style of the `Lv N · Title` tag). One item per slot, any slot may be empty (= default look).
- **Unlock** = kid's current level (Project 3 `level_for(xp(...))`) ≥ item `unlock_level`. Levels never go down, so unlocked items never re-lock.
- **Catalog** (Claude's call on names and art; owner asked for unicorns, crowns, ninja gear "and more", CS:GO/Steam name-card feel, 3–5 items per tier). Emblems are emoji (Claude's call — cheap, no asset pipeline):

| unlock | id | slot | name |
|---|---|---|---|
| 1 | `card-slate` | card | Slate |
| 1 | `emblem-star` | emblem | Star ⭐ |
| 1 | `title-basic` | title | Basic |
| 3 | `title-mint`, `title-coral`, `title-sky` | title | Mint, Coral, Sky |
| 3 | `emblem-lightning`, `emblem-paw` | emblem | Lightning ⚡, Paw 🐾 |
| 5 | `ring-mint`, `ring-coral`, `ring-sun` | ring | Mint, Coral, Sun |
| 5 | `emblem-ninja`, `emblem-unicorn` | emblem | Ninja 🥷, Unicorn 🦄 |
| 8 | `name-sun`, `name-mint`, `name-coral` | name | Sun, Mint, Coral |
| 8 | `emblem-crown`, `emblem-rocket` | emblem | Crown 👑, Rocket 🚀 |
| 12 | `card-grid`, `card-waves`, `card-stripes` | card | Grid, Waves, Stripes |
| 12 | `emblem-dragon` | emblem | Dragon 🐉 |
| 16 | `ring-glow-sun`, `ring-glow-violet`, `ring-pulse` | ring | Sun Glow, Violet Glow, Pulse |
| 16 | `emblem-katana` | emblem | Katana 🗡️ |
| 20 | `name-gold`, `name-holo`, `name-flame` | name | Gold, Holo, Flame |
| 20 | `emblem-gem` | emblem | Gem 💎 |
| 25 | `card-aurora`, `card-sheen`, `card-starfield`, `card-unicorn` | card | Aurora, Sheen, Starfield, Unicorn Holo |
| 25 | `emblem-crown-flame` | emblem | Blazing Crown 👑🔥 |

- **Animation:** cards from Lv12 move subtly (gradient drift, sheen sweep, twinkle); Lv16 rings glow/pulse; Lv20 names shimmer. All motion off under `prefers-reduced-motion` (static frame stays). Text on every card meets 4.5:1 contrast in light and dark.
- **Drip badge** (from the spec's built-in list): key `drip`, metric `slots_equipped` (count of non-empty slots), threshold `1`. Added to Project 3's `CATALOG`; `check_badges` runs after an equip.
- Equip changes are kid-only; parents can view, not change.
- Files < 500 lines (flair CSS may be split by slot: `frontend/src/v2/flair/cards.css`, `rings.css`, `names.css`, `titles.css`).

## Review Focus

1. **Equipping a locked item** (crafted request): rejected 403 "Reach level N to unlock that." and nothing changes. (Task 1 test.)
2. **Wrong slot** (`{slot: "ring", id: "card-sheen"}`): 400. (Task 1 test.)
3. **Catalog id with no CSS:** every catalog id must have a `.flair-<id>` rule, or the kid sees nothing. (Task 2 cross-check test.)
4. **Long names (20+ chars) and a 360px phone:** NameCard truncates with ellipsis, no overflow. (Task 2 test.)
5. **Removed/renamed catalog id still stored in a kid's equips:** ignored when rendering and dropped on next save, no crash. (Task 1 test.)

---

### Task 1: Catalog, equips, API

**Files:**
- Create: `backend/app/flair/__init__.py`, `backend/app/flair/catalog.py`
- Create: `backend/app/api/flair.py` (kid routes on `/api/v1/kid`)
- Create: `backend/alembic/versions/b2c3d4e5f6a7_user_flair.py` (`users.flair JSON NOT NULL DEFAULT '{}'`; revises Project 3's `a1b2c3d4e5f6`)
- Modify: `backend/app/models/user.py` (`flair` column)
- Modify: `backend/app/services/badges.py` (`drip` def + `slots_equipped` metric)
- Modify: Project 3 identity payloads — `progress()`, `leaderboard()` rows, profiles, parent `/today` kids — add `"flair": equipped(user)`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_flair.py`

**Interfaces:**
- `FlairItem(id: str, slot: str, name: str, unlock_level: int, emblem: str | None)` (frozen dataclass; `emblem` = the emoji for emblem items).
- `CATALOG: tuple[FlairItem, ...]`, `BY_ID: dict[str, FlairItem]`, `SLOTS = ("card", "ring", "name", "emblem", "title")`.
- `equipped(user: User) -> dict[str, str | None]` — all five slots, unknown ids → `None`.
- `GET /kid/flair` → `{"level": int, "items": [{id, slot, name, unlock_level, emblem, unlocked}], "equipped": {...}}`.
- `PUT /kid/flair` body `{"slot": str, "id": str | null}` → `{"equipped": {...}, "new_badges": [...]}`; validates slot (400 "That isn't a flair slot."), id exists (400), slot match (400 "That doesn't go there."), unlocked (403 "Reach level N to unlock that."); saves (dropping unknown ids), runs `check_badges`, commits.

- [ ] **Step 1: Failing tests:** catalog ids unique, every slot has a Lv1-or-default option, each tier 3–5 items; Lv1 kid GET → only Lv1 items `unlocked`; equip `emblem-star` → saved, `drip` badge awarded once; **equip `card-sheen` at Lv3 → 403 with "level 25"**; **wrong slot → 400**; unequip with `id: null`; **stored unknown id → `equipped` returns None and next PUT removes it**; parent token → 403 on PUT; profiles/leaderboard/today include `flair`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run backend suite + ruff + `test_migrations.py`, expect PASS.**
- [ ] **Step 5: Commit** `feat(api): flair catalog and equips`

---

### Task 2: Flair rendering — `NameCard` and styles

**Files:**
- Create: `frontend/src/v2/flair/NameCard.tsx`
- Create: `frontend/src/v2/flair/cards.css`, `rings.css`, `names.css`, `titles.css` (imported once from `pages/_app.tsx`)
- Modify: `frontend/src/v2/types.ts` (`Flair = Record<'card'|'ring'|'name'|'emblem'|'title', string | null>`, `FlairItem`)
- Test: `frontend/tests/v2/nameCard.test.tsx`, `backend/tests/test_flair_css.py`

**Interfaces:**
- `NameCard({ name, avatar, level, title, flair, emblems, size = 'md', children? })` — `size: 'sm' | 'md' | 'lg'` (`sm` = leaderboard row, `md` = kid card header, `lg` = profile/Locker preview). Root gets `className` `flair-card flair-${flair.card}` etc.; ring wraps the avatar, `name` class on the name, emblem emoji after the name (`emblems: Record<string,string>` from the catalog, so the component never hard-codes emoji), title tag `Lv N · Title` styled by `flair.title`. `children` render below (Project 3's XP bar/streak).
- CSS class per catalog id: `.flair-<id>`.

- [ ] **Step 1: Failing tests:** NameCard with `{card:'card-sheen', ring:'ring-sun', name:'name-gold', emblem:'emblem-crown', title:'title-mint'}` has those five classes and shows 👑 after the name; null flair → default classes only; **24-char name has `text-overflow: ellipsis` class and `title` attribute with the full name**; `test_flair_css.py` reads `../frontend/src/v2/flair/*.css` and asserts `.flair-<id>` exists for every `CATALOG` id that isn't an emblem (emblems render as text) — **and that every animated rule sits under `@media (prefers-reduced-motion: no-preference)`**.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement styles.** Port the mockup's `.f3` sheen and gradient name. Use Project 1 tokens for defaults; card backgrounds keep `--f-head-ink`-readable text in both modes.
- [ ] **Step 4: Run jest + type-check + lint and the backend test, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): animated name cards and flair styles`

---

### Task 3: Locker (customization area)

**Files:**
- Create: `frontend/src/v2/kid/Locker.tsx` (tabs per slot; grid of items; locked items dimmed with "Lv N"; selecting an unlocked item updates a live `NameCard size="lg"` preview; "Equip" saves; "Remove" clears a slot)
- Create: `frontend/src/v2/hooks/useFlair.ts` (`useFlair`, `useEquip`; `kid: true`; invalidate `['kid-today']`, `['profiles']`, `['leaderboard']`; show a toast for `new_badges`)
- Modify: `frontend/src/v2/kid/KidPage.tsx` (Locker entry point: a "Customize" button on the kid's own header opening the Locker view)
- Test: `frontend/tests/v2/locker.test.tsx`

- [ ] **Step 1: Failing tests:** locked item shows "Lv 25" and its Equip is disabled; clicking an unlocked card updates the preview's class before saving; Equip sends `PUT /kid/flair {slot:'card', id:'card-grid'}`; Remove sends `{slot, id: null}`; `new_badges: [{name:'Drip'}]` → toast "Badge unlocked: Drip".
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with gamer-cut controls (Project 1) and a `SegmentedControl` for slots.
- [ ] **Step 4: Run jest + type-check + lint, expect PASS.**
- [ ] **Step 5: Commit** `feat(frontend): kid locker for flair`

---

### Task 4: Flair everywhere + unlock celebrations

**Files:**
- Modify: `frontend/src/v2/components/ProgressHeader.tsx` (render through `NameCard size="md"`), `frontend/src/v2/components/Leaderboard.tsx` (`size="sm"`), `frontend/src/v2/components/ProfileModal.tsx` (`size="lg"`), sibling cards on `KidPage.tsx`, parent `KidCard.tsx`
- Modify: `backend/app/services/badges.py` (or wherever Project 3 builds the level celebration): level celebration `detail` lists newly unlocked items, e.g. `"New flair: Crown, Rocket, Sun name"` (items with `unlock_level` in `(celebrated_level, level]`)
- Modify: `frontend/src/v2/kid/AwardOverlay.tsx` (level celebration shows the new items as small chips with a "Go to Locker" button)
- Test: extend `frontend/tests/v2/progression.test.tsx`, `kidRewards.test.tsx`; `backend/tests/test_badges.py`

- [ ] **Step 1: Failing tests:** parent Today kid card, leaderboard row, profile modal and kid header each render `.flair-card` with the kid's equipped card class; level-up from 7 to 8 celebration detail names `Crown`, `Rocket`; overlay "Go to Locker" opens the Locker.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run backend + frontend suites, lint, type-check; expect PASS.**
- [ ] **Step 5: Commit** `feat: flair on every identity surface and unlock celebrations`
