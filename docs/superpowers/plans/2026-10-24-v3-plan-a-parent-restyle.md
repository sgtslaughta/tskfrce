# v3 Plan A — Parent Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every parent screen (plus login, join, reset, setup) the approved clean look and layouts from the v3 mockups, using data the app already has.

**Architecture:** A new parent token layer (`parent.css`) switched on by `data-look="parent"` on `<html>` so Mantine portals (menus, modals, toasts) get it too; the kid page sets `data-look="kid"` and keeps the `--f-*` fridge tokens untouched. A new `ParentShell` (icon rail on desktop, bottom tab bar on phone) replaces `FridgeShell`; each screen becomes list + detail. Two small backend additions: family `accent` and a parent run-detail endpoint. Anything that needs data from Plans B–F is **hidden**, never faked.

**Tech Stack:** Next.js (pages router) + Mantine 7 + TanStack Query, Jest + Testing Library, Playwright e2e; FastAPI + SQLAlchemy + Alembic, pytest, ruff.

**Spec:** `docs/superpowers/specs/2026-10-24-v3-redesign-design.md` (§0, §2, §3, §10, §11). Mockups (binding): `docs/superpowers/specs/2026-10-24-v3-redesign-mockups/01`–`07`. Errata §11 overrides mockups.

## Global Constraints

- Mockups are the spec: layout, order, wording, labels, icons, colours. When a mockup element needs Plan B–F data, omit it (no placeholders, no sample data).
- Parent tokens exactly as spec §2.2; accent list exactly as §2.3 (10 keys, default `neon` `#c3f832`); text on accent is always `#292928`.
- Contrast rules §2.4: no neon text/thin neon bars on light; light-mode meters = ink on `#e4e4e1`; inverse toasts; every chip has an icon.
- Font: DM Sans (weights 400/500/600/700) via `next/font/google`, CSS var `--font-parent`. Monospace for IPs/MACs uses existing `--font-mono`.
- Icons: npm `material-symbols` (Rounded, self-hosted font, ligatures) — not `@mui/icons-material`, not a CDN. Maker logos: npm `simple-icons`, import only the named icons. No emojis anywhere in parent UI (kid avatars render as initials on parent screens).
- Kid page (`/kid`) look must not change in this plan except the existing view-as-kid bar restyle (dark `#292928` bar, accent button) per mockup 08.
- Files ≤ 500 lines. Backend: ruff clean; migrations via Alembic (current head `f7a8b9c0d1e2`).
- Copy fixes from errata: invites "24 hours", reset links "30 minutes"; no Screen time section in Settings; no vacation/export/homework-exemption/“block similar devices”.

## Review Focus

1. **Portals on kid pages:** a Mantine menu/modal/toast opened on `/kid` must still use fridge styling (data-look switches on navigation, including client-side route changes). → Task 1 test `look attribute follows the route`.
2. **Accent edge cases:** unknown/missing `accent` from the server must fall back to neon, and Lilac must switch "Needs OK" to outline. → Task 1 test `unknown accent falls back to neon` + `lilac outlines needs-ok`.
3. **Phone width 360px:** no horizontal scroll on any parent page; rail hidden, tab bar shown. → Task 14 Playwright `no horizontal overflow at 360px`.
4. **One chore open at a time / chat closed widens left column:** opening a second chore closes the first; closing chat removes the chat column. → Task 5 tests.
5. **Missing later-plan data:** a parent page must render with today's API payloads (no `type`, no `activity`, no `accent` field on old servers) without crashing or showing empty boxes. → Task 14 e2e on the seeded demo + Task 6/7 tests `hides activity tab` / `hides deduct`.

---

### Task 1: Parent tokens, fonts, icons, accent plumbing (frontend)

**Files:**
- Create: `frontend/src/v2/parent/parent.css`, `frontend/src/v2/parent/accent.ts`, `frontend/src/v2/parent/Icon.tsx`, `frontend/src/v2/parent/useLook.ts`
- Modify: `frontend/src/v2/fonts.ts`, `frontend/pages/_app.tsx` (import `parent.css`, `material-symbols/rounded.css`), `frontend/src/v2/theme.ts`, `frontend/package.json`
- Test: `frontend/tests/v2/parentLook.test.tsx`, `frontend/tests/v2/parentCss.test.ts`

**Interfaces:**
- Produces: `ACCENTS: Record<AccentKey, { name: string; hex: string }>` and `type AccentKey = 'neon'|'sun'|'tangerine'|'bubblegum'|'lilac'|'sky'|'aqua'|'mint'|'peach'|'ice'`; `accentHex(key?: string | null): string` (unknown → neon); `useLook(look: 'parent' | 'kid'): void` (sets `document.documentElement.dataset.look`, and on `parent` sets `--p-acc` from the family accent and `data-accent="<key>"`); `<Icon name: string; fill?: boolean; size?: number; label?: string />` (renders `<span class="ms">` ligature, `aria-hidden` unless `label`).
- CSS classes later tasks use: `.p-card`, `.p-chip` + modifiers `[data-tone="acc|lav|grey|amb|red|ink"]`, `.p-btn` + `[data-variant="acc|ink|red|ghost"]`, `.p-pop` (solid popover: card bg, 2px ink border, 3px offset accent shadow), `.p-grid` (24px fading grid for detail panels), `.p-meter`/`.p-track`, `.p-toast`.

- [ ] **Step 1: Write failing tests**

```ts
// parentCss.test.ts
test('light and dark parent tokens match spec 2.2', () => {
  expect(css).toMatch(/\[data-look='parent'\][^{]*\{[^}]*--p-bg:\s*#f8f8f8/)
  expect(dark).toMatch(/--p-bg:\s*#1c1c1b/); expect(dark).toMatch(/--p-card:\s*#292928/)
})
test('light meters are ink on #e4e4e1, dark meters use accent', () => {
  expect(light).toMatch(/--p-meter:\s*#292928/); expect(light).toMatch(/--p-track:\s*#e4e4e1/)
  expect(dark).toMatch(/--p-meter:\s*var\(--p-acc\)/); expect(dark).toMatch(/--p-track:\s*#3d3d3b/)
})
test('toast uses inverse surface in both schemes', () => {
  expect(light).toMatch(/--p-tbg:\s*#292928/); expect(dark).toMatch(/--p-tbg:\s*#f4f4f2/)
})
test('fridge tokens untouched', () => { expect(fridge).toMatch(/--f-bg:\s*#f4f7fa/) })
// parentLook.test.tsx
test('unknown accent falls back to neon', () => expect(accentHex('purple')).toBe('#c3f832'))
test('all ten accents keep >= 7:1 with #292928', () => { for (const a of Object.values(ACCENTS)) expect(contrast(a.hex,'#292928')).toBeGreaterThanOrEqual(7) })
test('look attribute follows the route', () => {
  const { rerender } = renderHook(({ l }) => useLook(l), { initialProps: { l: 'parent' as const } })
  expect(document.documentElement.dataset.look).toBe('parent')
  rerender({ l: 'kid' }); expect(document.documentElement.dataset.look).toBe('kid')
})
test('lilac outlines needs-ok', () => {
  expect(css).toMatch(/\[data-accent='lilac'\][^{]*\.p-chip\[data-tone='lav'\][^{]*\{[^}]*background:\s*transparent/)
})
```
(`contrast` is a 6-line WCAG helper in the test file.)

- [ ] **Step 2: Run** `cd frontend && npx jest tests/v2/parentLook.test.tsx tests/v2/parentCss.test.ts` — expect FAIL (files missing).
- [ ] **Step 3: Implement.** `npm i material-symbols simple-icons`. Tokens under `[data-look='parent']` × `[data-mantine-color-scheme='light'|'dark']` with names `--p-bg --p-card --p-soft --p-ink --p-sub --p-line --p-lav --p-lavink --p-red --p-redbg --p-amb --p-ambink --p-grid --p-meter --p-track --p-tbg --p-tfg --p-tact --p-acc` (values from spec §2.2/§2.4; `--p-acc` default `#c3f832`). Add `DM_Sans` to `fonts.ts` as `parent` with `variable: '--font-parent'` and add its variable to the `<body>` className where the others are applied. In `theme.ts` change `Menu/Popover/Select/MultiSelect` dropdown classNames from `f-pop*` to `p-pop*`; `f-pop` rules in `controls.css` stay scoped to `[data-look='kid']` so kid menus keep the fridge look.
- [ ] **Step 4: Run tests again** — PASS. Update `tests/v2/theme.test.ts` expectations for the new classNames.
- [ ] **Step 5: Commit** `feat(ui): parent token layer, DM Sans, icons, accent plumbing`

### Task 2: Backend — family accent + run detail

**Files:**
- Create: `backend/alembic/versions/<rev>_family_accent.py`
- Modify: `backend/app/models/family.py`, `backend/app/api/family.py` (`_fam_out`, `FamilyPatch`), `backend/app/api/chores.py`, `backend/app/services/chores.py` (`steps_out`)
- Test: `backend/tests/test_parent_api.py`, `backend/tests/test_migrations.py`; frontend `src/v2/types.ts`, `src/v2/hooks/useFamily.ts`, `src/v2/hooks/useRunDetail.ts` (create)

**Interfaces:**
- Produces: `family_settings.accent` String(12) NOT NULL default `'neon'`, CHECK in the 10 keys; `GET /api/v1/family` includes `"accent"`; `PATCH /api/v1/family {accent}` (422 on unknown key). `GET /api/v1/chores/{run_id}` (parent only) →
  `{ id, title, points, state, due_time, kid_ids: number[], steps: [{id, title, done, done_at: str|null}], photos: [{id, thumb_url}], thread_ref: str }`.
  `steps_out` gains `done_at` (`utc_z` string or null) — kid API output gets the extra key too (harmless).
- Frontend: `Family.accent?: AccentKey`; `useRunDetail(runId: number | null)` (query key `['run', id]`, disabled when null).

- [ ] **Step 1: Failing tests** — `test_family_accent_default_neon`, `test_patch_family_accent_rejects_unknown` (422), `test_run_detail_steps_have_done_at` (tick one step, assert `done_at` set, other null), `test_run_detail_photos` (one ChorePhoto → one entry with `thumb_url`), `test_run_detail_kid_forbidden` (kid token → 403), migration up/down in `test_migrations.py`.
- [ ] **Step 2: Run** `cd backend && ../.venv/bin/python -m pytest tests/test_parent_api.py -k "accent or run_detail" -q` → FAIL.
- [ ] **Step 3: Implement** (reuse `svc.with_detail`, existing photo thumb URL builder, `chat` thread ref format used by the frontend `ChatRedirect`).
- [ ] **Step 4: Run** full backend suite `../.venv/bin/python -m pytest -q` + `ruff check .` → all pass.
- [ ] **Step 5: Commit** `feat(api): family accent setting and parent run detail`

### Task 3: ParentShell — rail, phone tab bar, More page, bell placement

**Files:**
- Create: `frontend/src/v2/parent/ParentShell.tsx`, `frontend/src/v2/parent/Rail.tsx`, `frontend/src/v2/parent/TabBar.tsx`, `frontend/src/v2/parent/ListDetail.tsx`, `frontend/src/v2/parent/MorePage.tsx`, `frontend/pages/more.tsx`
- Modify: every `FridgeShell` user (TodayPage, DevicesPage, KidsPage, SettingsPage, chat page) → `ParentShell`; delete `FridgeShell.tsx`, `AccountMenu.tsx` once unused; `Bell.tsx` gets a `placement: 'rail' | 'header'` prop
- Test: `frontend/tests/v2/parentShell.test.tsx`

**Interfaces:**
- Produces: `<ParentShell title: string; list?: ReactNode; children: ReactNode; actions?: ReactNode />` (calls `useLook('parent')`; renders rail ≥ 768px, header + tab bar < 768px; when `list` is given renders `ListDetail`). `<ListDetail list: ReactNode; detail: ReactNode; listTitle: ReactNode />` (320px list column, detail with `.p-grid`; on phone the list shows first and the detail replaces it with a back link `← <listTitle>` when an item is selected via `?item=`).
- Rail items (in order, mockup 02): logo `@`, bell (count badge), `home` Today `/`, `devices` Devices `/devices`, `group` Kids & chores `/kids`, `forum` Chat `/chat` (accent dot when unread), spacer, `settings` Settings `/settings`, `logout` Log out. Tab bar (mockup 04): Today, Devices, Kids, Chat (red count), More (`/more`). More page: profile card (name, "Owner · <family>", box health chip from `BlockerBanner` data), Settings list (links to `/settings?section=…`), Help & guide (`HELP_URL`), Log out.

- [ ] **Step 1: Failing tests** — `rail has the eight items in order with aria-labels`, `active rail item marked aria-current`, `tab bar shows below 768px and rail hides` (mock `matchMedia`), `more page lists settings sections and log out`, `chat unread shows dot on rail and count on tab bar`.
- [ ] **Step 2: Run** jest on the file → FAIL.
- [ ] **Step 3: Implement**; keep `startSignOut/cancelSignOut` logout flow from `FridgeShell`; keep `BlockerBanner` at the top of the detail area; keep `ChatDock` mount.
- [ ] **Step 4: Run** `npx jest` (whole suite; fix tests that targeted FridgeShell markup by asserting the same behaviour on ParentShell).
- [ ] **Step 5: Commit** `feat(ui): parent shell with icon rail and phone tab bar`

### Task 4: Shared parent components + states + toasts with Undo

**Files:**
- Create: `frontend/src/v2/parent/Chip.tsx`, `frontend/src/v2/parent/HeaderChips.tsx`, `frontend/src/v2/parent/MakerLogo.tsx`, `frontend/src/v2/parent/GlyphPicker.tsx`, `frontend/src/v2/parent/states.tsx`
- Modify: `frontend/src/v2/notify.tsx` (toasts), `frontend/src/v2/components/States.tsx` (re-export parent states on parent pages)
- Test: `frontend/tests/v2/parentParts.test.tsx`

**Interfaces:**
- `<Chip tone: 'acc'|'lav'|'grey'|'amb'|'red'|'ink'; icon: string; children />` — always icon + text.
- `<HeaderChips items: { icon?: string; logo?: MakerKey; text: string; tone?: 'acc'|'mono'|'plain' }[] />` (the chip row under titles, mockups 02 Devices/Groups/Chores).
- `makerKey(vendor: string | null): MakerKey | null` and `<MakerLogo vendor />` — map (case-insensitive substring) for Apple, Samsung, Google, Nintendo (Switch → `nintendoswitch`), Sony, LG, Amazon; unknown → null (caller shows device glyph).
- `<GlyphPicker value: string; onChange; choices: string[] />` (search + grid, mockup 02 new-type sheet) — used by later plans; Plan A uses it nowhere visible except Groups is deferred, so ship with tests only.
- `states.tsx`: `EmptyState({icon, title, body, actions})`, `Skeleton({rows})`, `ErrorPanel({kind: 'unreachable'|'crash'|'notfound'|'expired', onRetry?})`, `Banner({tone:'red'|'amb', icon, title, body, action?})` with copy from mockup 05 verbatim.
- `toastOk(msg, { undo?: () => void })` keeps current signature; with `undo` the toast shows **Undo** and the caller's action is delayed: export `withUndo<T>(run: () => Promise<T>, msg: string, ms = 5000): void` — shows the toast immediately and calls `run` after `ms` unless Undo was pressed.

- [ ] **Step 1: Failing tests** — `chip renders icon and text`, `makerKey maps Apple/Nintendo/unknown`, `withUndo runs after 5s` and `withUndo cancelled by Undo` (fake timers), `unreachable panel copy matches mockup` ("Can't reach your home box"), `error toast uses err tone`.
- [ ] **Steps 2–4:** run → implement → run whole suite.
- [ ] **Step 5: Commit** `feat(ui): parent chips, maker logos, states and undo toasts`

### Task 5: Today (desktop + phone) — mockups 01, 04

**Files:**
- Create: `frontend/src/v2/today/KidList.tsx`, `frontend/src/v2/today/ChoreRow.tsx`, `frontend/src/v2/today/ChoreOpen.tsx`, `frontend/src/v2/today/ChatColumn.tsx`, `frontend/src/v2/today/NeedsYouList.tsx`
- Modify: `frontend/src/v2/today/TodayPage.tsx`; retire `KidTabs.tsx`, `KidCard.tsx`, `NeedsYou.tsx`, `PINsNudge.tsx`, `NewDevicesBanner.tsx` from Today (delete if unused elsewhere; Leaderboard leaves parent Today — kid FamilySection keeps it)
- Test: `frontend/tests/v2/today.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `useToday()`, `useRunDetail(id)` (Task 2), `useApproveChore`, `useSendBack`, `useDecideRedemption`, `useThreads`, existing `ThreadView` (add `compact?: boolean` and `refLabel?: string` props for the column), `ParentShell`, `Chip`, `withUndo`.
- `KidList` (list column): tabs **Today / Needs you · N**; kid cards (initial avatar, name, "x of y chores · <state>", status chip: `Online` acc / `Needs OK` lav / `All done` grey / `Locked` grey); selected card expands: progress meter, Points, Streak, Next reward, Locks at (from `progress`, `devices`). "Needs you" tab renders `NeedsYouList` (combined, all kids) with Approve/Send back/Decline inline.
- Detail: `<Kid>'s day`, buttons **View as kid** (→ `/kid?as=<id>`) and **Add chore** (→ `/kids?section=chores&kid=<id>`), progress line "x of y done", chore list, summary strip (Status, Today, Earned today, Last active).
- `ChoreRow` collapsed by default; **only one open at a time** (state lives in the detail list). Done: tick + line-through + "Done h:mm PM". Chips: Approved (acc, `check`), Needs OK (lav, `hourglass_top`), To do (grey, `radio_button_unchecked`), Sent back (red outline, `undo`). Type icon column is **omitted** until Plan B.
- `ChoreOpen`: two columns — left: indented steps (`done_at` time), photos (thumbs), action panel (soft grey, centred, bottom): **Approve +N** (acc, via `withUndo`), **Send back**, **Open chat**. (Deduct points omitted until Plan B.) Right: `ChatColumn` only when chat is open (opened from a step's reply button, a photo badge, or Open chat); header "↳ <step or chore>" + close; full row height; composer pinned bottom. Chat closed → left column full width. Phone (< 768px): chat opens as a bottom sheet (Mantine `Drawer position="bottom"` size 58%).
- Phone (< 768px, mockup 04): the kid list becomes an **avatar strip** (initials; lav count badge = items waiting, acc tick = all done, dashed "Add"); the selected kid's summary card (chips Online / Lv / streak, eye button = View as kid, meter, 4 facts) sits above the chore list.
- Empty states: no kids → `EmptyState` "Add your first kid" (Add a kid, Run setup); kid with no chores → "Nothing for <Kid> today"; Needs you empty → "All caught up".

- [ ] **Step 1: Failing tests** — `kid list shows Today and Needs you tabs with count`, `selecting a kid shows <Kid>'s day`, `chore rows start collapsed`, `opening a second chore closes the first`, `done chore shows line-through and Done time`, `chat column appears only after reply and closing it removes it`, `approve uses undo toast`, `needs you lists all kids' items`, `no kids shows Add your first kid`, `no leaderboard on Today`.
- [ ] **Steps 2–4:** run → implement → full jest.
- [ ] **Step 5: Commit** `feat(today): list-detail Today with one-open chores and chat column`

### Task 6: Devices + Groups — mockup 02 (Devices), 04

**Files:**
- Create: `frontend/src/v2/manage/DeviceList.tsx`, `frontend/src/v2/manage/DeviceDetail.tsx`, `frontend/src/v2/manage/GroupDetail.tsx`, `frontend/src/v2/manage/privateMac.ts`
- Modify: `DevicesPage.tsx`, `DevicesSection.tsx`, `DeviceRow.tsx`, `GroupsPanel.tsx`, `DeviceQuickMenu.tsx` (restyle to `.p-pop`)
- Test: `frontend/tests/v2/devices.test.tsx`

**Interfaces:**
- `isPrivateMac(mac: string): boolean` — true when the first octet has the locally-administered bit (`0x02`) set.
- List: tabs **Devices · N / Groups · N**; unassigned devices pinned on top with amber "Who's this?" chip; row = device glyph (from existing type guess or `devices_other`) + `MakerLogo` badge + name + "owner · last seen" + chip Open (acc) / Locked (grey) / Exempt (lav) / Guest (grey).
- Device detail: icon tile, name, `HeaderChips` [maker logo + vendor, `Online now` (acc) or `Last seen <rel>` (plain), IP (mono), owner]; **Lock now** (red) and **Unlock 30 min** using existing override API. Tabs **Overview · Network** only (**Activity hidden until Plan D**). Overview: Details card (name edit, owners, groups, Guest switch), Right now card (state, why, locks at, override). Network: IPv4, IPv6 list, MAC masked middle (`3a:1f:••:••:c2:09`), Private MAC chip (amber "Yes, random"), hostname, maker, first seen, last seen, resisting (from `resisting_since`); amber tip card when private MAC is on (copy from mockup 02). Online timeline and Address changes rows omitted (Plan D).
- Groups: list with device-icon stack + "N devices · owners"; detail with `HeaderChips` (N devices, N open, N locked, owners), **Lock group / Unlock 30 min / Back to schedule**, devices in group (remove ×, Add a device), group name; group icon picker and switches omitted (Plan D); "Hours for this group" timeline uses Task 9's `HoursTimeline`.

- [ ] **Step 1: Failing tests** — `isPrivateMac('3a:1f:00:00:c2:09') true and ('00:1f:…') false`, `unassigned device pinned first with Who's this?`, `detail header chips show maker, online, ip`, `activity tab hidden`, `mac masked middle octets`, `group lock calls group override endpoint`.
- [ ] **Steps 2–4**, **Step 5: Commit** `feat(devices): list-detail devices and groups`

### Task 7: Kids & chores — Chores, Kids, Rewards, Badges — mockup 02

**Files:**
- Create: `frontend/src/v2/manage/SectionTabs.tsx`, `frontend/src/v2/manage/ChoreList.tsx`, `frontend/src/v2/manage/KidDetail.tsx`, `frontend/src/v2/manage/RewardsPages.tsx`, `frontend/src/v2/manage/BadgesPages.tsx`
- Modify: `KidsPage.tsx`, `ManageLayout.tsx` (replaced by `SectionTabs` + `ListDetail`; delete if unused), `ChoreEditor.tsx`, `KidsSection.tsx`, `KidEditor.tsx`, `RewardsPanel.tsx`, `CustomBadgesPanel.tsx`, `FamilyCards.tsx` (move `ScreenTimeCard` content into Rewards → Screen time)
- Test: `frontend/tests/v2/manage.test.tsx`, `rewards.test.tsx`, `customBadges.test.tsx` (update)

**Interfaces:**
- `SectionTabs` (list-column tabs) **Chores · N / Kids · N / Rewards / Badges**, URL `?section=` kept.
- Chores: list (flat until Plan B adds type groups) with assignee avatar stack; editor restyled as cards: header chips (points, repeat, needs photo), Basics (name, points, due by, needs photo switch), Steps (drag/× /Add a step; chain links and step due chips omitted until Plan B), Who & when (kid picker chips, **Each does it / First one wins / Team effort**, day buttons), Save / Delete / Duplicate. Type picker and notes preview omitted (Plan B).
- Kids: list (initial avatar, "Level N · pts", chip PIN set / No PIN / Online / Locked); detail header (initial tile, name, "Level · title · streak"), **View as kid**, **Bonus**, **Edit** (Deduct omitted until B; Age group omitted until C), cards Profile, Devices, Chores assigned, Points history (existing ledger).
- Rewards: list items **Requests · N**, **Catalogue**, **Screen time**, **History**; each its own pane. Requests: cards with cost and balance before → after; Approve disabled with red "Not enough points" when short; Approve all; Decline with note if the API supports a note (else no note field). Catalogue: grid with icon (existing emoji rendered **as text is not allowed** → render a generic `redeem` glyph until Plan E migrates icons), price, four kid affordability circles, Hidden state, New reward card, editor (name, price, Kids can see it). Screen time: on/off + price (existing fields; other controls Plan E). History: render only if a decided-redemptions endpoint exists; otherwise omit the list item.
- Badges: **All badges** (tier legend + per-badge card with five tier pips per kid; built-in emoji → parent glyph via `BADGE_GLYPH: Record<string,string>` in `src/v2/manage/badgeGlyphs.ts`, fallback `military_tech`), **Custom badges** (existing editor restyled; award flow with "<tier> → <tier>" preview), **Recent awards** (if awards list exists; else omit).

- [ ] **Step 1: Failing tests** — `section tabs keep ?section in url`, `chore editor shows Each does it / First one wins / Team effort`, `kid detail has View as kid, Bonus, Edit and no Deduct`, `requests disable approve when balance short`, `screen time lives under rewards`, `settings has no screen time section`, `badge glyph map falls back to military_tech`, `no emoji characters rendered in parent kids page` (regex `\p{Extended_Pictographic}` on container text).
- [ ] **Steps 2–4**, **Step 5: Commit** `feat(kids): list-detail chores, kids, rewards and badges`

### Task 8: Chat page — mockup 02 (Chat)

**Files:** Modify `frontend/pages/chat.tsx`, `src/v2/chat/ThreadList.tsx`, `ThreadView.tsx`, `chatDock.css`; Test: `tests/v2/chat.test.tsx`.
**Interfaces:** list column = search box (client-side filter on title and last message) + tabs **All · Chores · Family** (Notes tab added in Plan B); rows with icon tile, title, last line, unread badge (acc). Thread header: icon, title, `HeaderChips` (state, points for chore threads), **Approve / Send back** for chore threads needing OK. Messages: day separators ("Today"), system lines with `task_alt`, "↳ step / Photo 1" reference labels, inline photos and GIFs. Composer: photo, GIF, send. Right side panel (≥ 1250px) for chore threads: Steps (with times from `useRunDetail`), Photos, "<Kid> today". Reactions, typing, @mentions, quick replies: Plan E (omit).
- [ ] Tests: `search filters threads`, `chore thread header shows approve when needs OK`, `day separator renders`, `side panel hidden below 1250px`. Steps 1–5 as usual. Commit `feat(chat): parent chat restyle`.

### Task 9: Settings — Family, Hours, Appearance, GIFs, Parents — mockup 02 (Settings)

**Files:** Create `src/v2/manage/HoursTimeline.tsx`, `src/v2/manage/AppearancePane.tsx`; Modify `SettingsPage.tsx`, `FamilyCards.tsx`, `HoursSection.tsx`, `WindowEditor.tsx`, `ParentsList.tsx`, `InviteSection.tsx`, `ColorSchemeToggle.tsx`; Test `tests/v2/settings.test.tsx` (create).
**Interfaces:**
- Sections in this order (Plan A): **Family, Hours, Appearance, GIFs, Parents** (Chore types → B, Notifications → F insert later at their mockup positions).
- `HoursTimeline({ windows, kids, groups })`: 24-hour axis (12a/6a/12p/6p/12a), one row per window set; textures by scope until Plan D adds categories: family-wide = **solid**, per child = **crosshatch** + kid initial, per group = **horizontal lines**; ink pattern over `--p-acc`; time labels on light tags. Legend shows only textures in use. Add window + edit per row (existing `WindowEditor`, restyled: name, days, one or more time ranges).
- Appearance: 10 swatches (name under each, selected outline) → `PATCH /family {accent}`, optimistic update of `--p-acc`; mode **Light / Dark / Match device** (Mantine color scheme, existing manager); light+dark preview cards.
- Family: name, time zone, day resets at, early-finish bonus cap; Block new devices switch; home box chip. Parents: owner chip, Reset link, pending invite "Invite sent · expires in N hours", Cancel, **Invite a parent**.
- [ ] Tests: `settings sections in order`, `accent swatch patches family and sets --p-acc`, `match device option present`, `hours row texture: per child crosshatch`, `invite expiry says hours`. Commit `feat(settings): parent settings restyle with appearance`.

### Task 10: Bell — mockup 02 (bell)

**Files:** Modify `src/v2/components/Bell.tsx`, `bell.css`; Test `tests/v2/bell.test.tsx`.
**Interfaces:** `.p-pop` panel with pointer toward the rail; header "Notifications" + Mark all read; filter pills **All · N / Needs you · N / Alerts · N** (Needs you = `chore_submitted`, `redemption_request`; Alerts = `new_device`, `device_resisting`; everything in All); groups **Today / Earlier**; item = severity icon tile (red for resisting, amber new device, lav approvals, acc badges/levels), title, sub line, unread dot; inline actions: chore → **Approve +N** / **Send back**; redemption → **Approve / Decline**; new device → **Who's this?** (→ `/devices?item=<id>`); resisting → **View**. Footer: Notification settings (hidden until Plan F) · See all.
- [ ] Tests: `filters count by kind`, `approve from bell calls approve endpoint`, `earlier group for read items`. Commit `feat(bell): parent bell restyle with inline actions`.

### Task 11: Login, join, reset — mockup 06

**Files:** Modify `src/v2/login/LoginForm.tsx`, `RegisterForm.tsx`, `ResetForm.tsx`, `src/v2/components/AuthBrand.tsx`, pages `login.tsx/register.tsx/reset.tsx` (call `useLook('parent')`); Test `tests/v2/login.test.tsx`, `register.test.tsx`, `reset.test.tsx`.
**Interfaces:** split layout (stacked under 900px). Left: `#292928` panel with grid, wordmark top-left, `<h2>Chores done. <em>Wi‑Fi on.</em></h2>` (U+2011 non-breaking hyphen, `white-space: nowrap` on `em`) + "Your family's chore chart, wired to the home network." anchored **bottom-left** (padding 36px 40px 44px). No other content. Right: "Welcome back" / "Parents, log in to manage chores and devices.", error banner, Username, Password (show/hide), **Keep me logged in** (checkbox; sends `remember: true` — if the backend ignores it, keep the box, wiring is Plan-independent follow-up noted in the PR), Forgot password? (opens the forgot pane), Log in, "or", dashed **I'm a kid** card ("Go to your checklist, no password") → `/kid`, footer "t@sk4ce v<version> · <host>". Join: invite card (who, expiry in hours), name, username, password + strength bar (4 segments by length/classes). Reset: new password ×2, success state, Back to log in. Forgot pane: "Ask another parent" + only-parent command `docker compose exec backend python -m app.cli reset-password <you>`.
- [ ] Tests: `login panel has no status or activity`, `headline wifi on is a single nowrap span`, `kid card links to /kid`, `forgot pane shows cli command`. Commit `feat(auth): parent login, join and reset restyle`.

### Task 12: Setup wizard — mockup 07

**Files:** Modify `src/v2/setup/WizardFrame.tsx`, `StepParent/StepFamily/StepKids/StepChores/StepDevices/StepWindows/StepRemote.tsx`, `starterChores.ts`; Test `tests/v2/setup.test.tsx`.
**Interfaces:** dark left panel: "t@sk4ce setup", 7 clickable steps (titles + sub-lines from mockup: You/Parent account, Family/Name, time zone, Kids/Names, PINs, Chores/Pick starters, Devices/Who owns what, Hours/Bedtime, school nights, Remote access/Tailscale + "Optional"), done = accent tick circle joined by accent line, active outlined; footer "Step N of 7 · about M min left" + meter. Right: eyebrow "Step N of 7", title, sub, card, nav (Back ghost, Skip where it exists today, Next ink). Starter chores: tap-to-select cards with points (type labels omitted until Plan B). Devices: pulse "Looking for devices… N found", rows with maker logo, name, IP, kid initial toggles (multiple allowed — existing owners API) + Guest, amber Private MAC chip, tip card, "N of M assigned". Hours: `HoursTimeline` + **Add hours** + edit pencil per row opening an inline editor (Name, Days, one or more Times online ranges, Cancel/Delete/Save) — family-wide windows only in setup. Finish screen: "You're all set", summary counts, **Go to Today**, **Set up notifications** (hidden until Plan F).
- [ ] Tests: `steps clickable and mark earlier steps done`, `device can be assigned to two kids`, `add hours opens editor with days and times`, `finish screen links to today`. Commit `feat(setup): setup wizard restyle`.

### Task 13: Redirect, error and kid-preview polish — mockups 05, 08

**Files:** Modify `src/v2/components/RequireParent.tsx`, `pages/[...slug].tsx` (404), `src/v2/queryClient.ts` (unreachable detection → `ErrorPanel` with 8s auto-retry), `src/v2/kid/KidPage.tsx` (view-as-kid bar restyle only: dark `#292928` bar, `visibility` icon, "Viewing as <Name> · preview", accent **Back to parent**; kid page calls `useLook('kid')`); Test `tests/v2/states.test.tsx` (create), `kidPreview.test.tsx` (update).
**Interfaces:** session expired → `/login?next=<path>` and login returns to `next`; setup unfinished → `/setup?step=<n>`; kid on parent URL → "This part is for parents" then `/kid`; 404 "That page isn't here" + Go to Today; expired invite/reset link → "This invite has expired" with "Invites last 24 hours and reset links 30 minutes."
- [ ] Tests: `login returns to next`, `404 copy`, `expired copy states real ttl`, `preview bar uses parent look and kid content stays fridge`. Commit `feat(ui): states, redirects and preview bar polish`.

### Task 14: Visual verification against the mockups

**Files:** Modify `frontend/e2e/screens.spec.ts`, `frontend/e2e/parent.spec.ts`; outputs to `frontend/e2e/__shots__/v3/` (gitignored if large).
- [ ] **Step 1:** Add Playwright tests: `no horizontal overflow at 360px` (each parent route: `document.documentElement.scrollWidth <= 360`), `dark and light screenshots for /, /devices, /kids, /chat, /settings, /login, /setup at 1280×800 and 390×844`, `kid page keeps fridge tokens` (computed `--f-bg` on `/kid` = `#f4f7fa` light).
- [ ] **Step 2:** Run against the lab/demo per `scripts/lab.sh` docs; all pass.
- [ ] **Step 3:** Side-by-side check each screenshot with its mockup (01–07); list every visible difference in `docs/superpowers/plans/2026-10-24-v3-plan-a-qa.md` and fix all that are not Plan B–F data. Owner reviews screenshots before merge.
- [ ] **Step 4:** Full `npx jest`, `npm run lint`, backend `pytest -q`, `ruff check .`.
- [ ] **Step 5: Commit** `test(e2e): v3 parent screens visual checks`
