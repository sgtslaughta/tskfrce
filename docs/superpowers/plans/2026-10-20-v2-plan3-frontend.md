# t@sk4ce v2.0 — Plan 3: Frontend (fridge-chart UI + setup wizard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the v1 landing experience with the v2 screens: setup wizard, parent Today, kid lock screen, and devices/kids/settings management, wired to the Plan 1 backend.

**Architecture:** Same Next.js 15 Pages Router app and Mantine 8. New code lives under `frontend/src/v2/` (theme, api, hooks, components) and new routes in `frontend/pages/`. React Query (already installed) handles all v2 data, through one small fetch client that reuses the existing token storage. The v1 hub moves to `/hub` ("Classic") until v2.1 restyles chat and gamification.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Mantine 8.2, @tanstack/react-query 5, `next/font/google` (Fredoka, Nunito, self-hosted at build), Jest 30 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-20-task4ce-v2-design.md` (read §6, §7.4, §9 in full; §5 for lock semantics).
**Backend contract:** read `backend/app/api/{setup,family,devices,kids,windows,chores,kid,auth}.py` and `backend/app/schemas/{lock,chore}.py` for exact request/response shapes. The proxy maps `/api/proxy/<x>` → `/api/v1/<x>`.

## Global Constraints
- Display name **t@sk4ce** in UI copy; slug `task4ce` in code and storage keys.
- Look: **Fridge chart**. Fredoka for display, names and buttons; Nunito for body. Cards have a 3px ink outline, 18px radius and a hard 4px 4px 0 shadow. Sticker labels are rotated -2deg.
- Tokens (exact):

| token | light | dark |
|---|---|---|
| bg | `#E6EFF1` | `#18213F` |
| card | `#FFFFFF` | `#232F57` |
| ink | `#1D2B53` | `#F1F5FF` |
| line | `#1D2B53` | `#0C1229` |
| sun | `#FFC93C` | `#FFC93C` |
| red | `#FF6B4A` | `#FF7A5C` |
| green | `#7BD389` | `#6FD08A` |
| sub | `#4A5A80` | `#B4C2E6` |
| mute | `#DCE4F2` | `#34416B` |

- Light and dark follow the system setting, with a manual toggle persisted in `localStorage['task4ce-color-scheme']`, wrapped in try/catch.
- Copy: plain words, sentence case, no jargon ("Internet is paused", "offline", "online", "Approve"). Errors say what happened and how to fix it. Buttons name their action, and success toasts reuse the action word ("Approve" → "Approved").
- Chip collapse: more than **5** chores or more than **3** devices collapses to a summary like `✓ 4/6 · +3 devices`; tap to expand.
- Accessibility floor: visible keyboard focus, `aria-label` on icon-only buttons, honour reduced motion, 44px touch targets, and the layout must work at 360px width.
- Files < 500 lines. Components < 250 lines where practical.
- No new runtime dependencies. Dev dependencies allowed: `jest-environment-jsdom`, `@testing-library/user-event`.
- Gate before every commit: `cd frontend && npm run lint && npm run type-check && npm test -- --ci`.
- Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **Kid on a shared device:** `/kid/whoami` returns 2+ kids. Show an avatar picker and never auto-pick. A PIN pad appears only if `has_pin`.
2. **Unknown device on /kid:** `device: null`. Show "This device isn't set up yet. Ask a parent to add it." with no login.
3. **Expired parent token mid-session:** a 401 on a v2 query goes through refresh once, then redirects to `/login?next=<path>`, with no infinite loop.
4. **Setup already done:** `GET /setup` returns `needed:false`, so `/setup` redirects to `/login`. When needed is true, every parent route redirects to `/setup`.
5. **Many chips:** a kid with 9 chores and 6 devices collapses correctly, and the expanded row wraps at 360px without horizontal scroll.

---

### Task 1: Foundation (serial; everything else builds on it)

**Files:**
- Modify: `frontend/jest.config.js` (`moduleNameMapping` → `moduleNameMapper`, testMatch `**/*.test.ts?(x)`, drop the 70% threshold), `frontend/package.json` (devDependencies above; `"test": "jest"`), `frontend/pages/_app.tsx`, `frontend/pages/_document.tsx`, `frontend/src/contexts/UnifiedAuthContext.tsx` (role mapping), `frontend/src/services/api.ts:201` (delete the `/redis` call and its callers).
- Create: `frontend/src/v2/theme.ts`, `frontend/src/v2/fridge.css`, `frontend/src/v2/fonts.ts`, `frontend/src/v2/api.ts`, `frontend/src/v2/types.ts`, `frontend/src/v2/queryClient.ts`, `frontend/src/v2/components/{StickerCard,LockBadge,ChoreChip,DevicePill,Sticker,ColorSchemeToggle,FridgeShell,RequireParent}.tsx`, `frontend/src/v2/collapse.ts`, `frontend/tests/v2/{collapse,api,RequireParent}.test.ts(x)`.

**Interfaces — Produces** (later tasks import these exactly):
- `fridgeTheme: MantineThemeOverride` with the token colors registered as Mantine colors `ink`, `sun`, `fridgeRed`, `fridgeGreen`. CSS variables `--f-bg --f-card --f-ink --f-line --f-sun --f-red --f-green --f-sub --f-mute` are defined in `fridge.css` for `[data-mantine-color-scheme="light"|"dark"]`.
- `fredoka`, `nunito` from `next/font/google`, exposed as CSS vars `--font-display` and `--font-body`.
- `api<T>(path: string, init?: { method?: string; body?: unknown; kid?: boolean }): Promise<T>`:
  - Prefixes `/api/proxy`.
  - Sends the parent bearer token from the existing tokenManager, or the kid token from `localStorage['task4ce-kid-token']` when `kid:true`.
  - On a parent 401, refreshes once via the existing refresh, then throws `AuthError`.
  - Throws `ApiError { status, detail }` with the backend `detail` message.
- `types.ts`: `Today`, `TodayKid`, `ChoreState = "done"|"needs_you"|"todo"`, `Device`, `Group`, `Kid`, `TimeWindow`, `Family`, `KidWhoami`, `KidToday`, mirroring the backend schemas exactly.
- `collapseRow(chores: number, devices: number): { collapsed: boolean; summary: string }` (>5 chores or >3 devices). Summary format: `✓ {done}/{total} · +{n} devices`. Signature: `collapseRow(done, total, devices)`.
- Components:
  - `StickerCard({children, tone?})`
  - `LockBadge({online, size?})`, with aria-label "Online"/"Offline"
  - `ChoreChip({state})`
  - `DevicePill({name, kind, online, onClick?})`, kind ∈ phone|console|tv|laptop|other, shown as an emoji icon
  - `Sticker({children})`
  - `ColorSchemeToggle()`
  - `FridgeShell({title, children, actions?})`: top bar with t@sk4ce wordmark, day name, nav (Today `/`, Devices `/devices`, Kids & chores `/kids`, Settings `/settings`, Classic `/hub`), toggle, logout. Mobile: nav collapses into a burger.
  - `RequireParent({children})`: checks `GET /setup` → `/setup` if needed; not logged in → `/login?next=`; role kid → `/kid`.
- `_app.tsx`: wraps the app in `QueryClientProvider`, `MantineProvider theme={fridgeTheme} defaultColorScheme="auto"` (drop the legacy forced scheme), Notifications, and the existing UnifiedAuthProvider and NotificationProvider. Keep the legacy ThemeContext only if legacy components need it; it must not force the scheme.
- UnifiedAuthContext: `user.role` is `"parent"|"kid"` from `/auth/me` or the login response. Legacy `admin|organizer` → `parent`, `user` → `kid`.

- [ ] Step 1: Jest config fix, devDependencies install, `npm test` runs the existing health test. Commit `chore(frontend): working jest setup`.
- [ ] Step 2: Write tests: `collapse.test.ts` (`collapseRow(2,5,3)` → not collapsed; `collapseRow(4,6,0)` → collapsed, summary `✓ 4/6 · +0 devices`; `collapseRow(1,2,4)` → collapsed); `api.test.ts` (mock `fetch`: adds bearer; kid token when `kid:true`; 401 → refresh once then `AuthError`; error `detail` surfaced); `RequireParent.test.tsx` (setup needed → push `/setup`; kid → `/kid`). RED.
- [ ] Step 3: Implement theme, fonts, css, api, types, queryClient, components, `_app` wiring, role mapping, and the `/redis` removal. GREEN.
- [ ] Step 4: Gate plus `npm run build` succeeds. Commit `feat(frontend): fridge theme, v2 api client and shell`.

### Task 2: Setup wizard `/setup` (parallel after T1)

**Files:** Create `frontend/pages/setup.tsx`, `frontend/src/v2/setup/{WizardFrame,StepFamily,StepParent,StepKids,StepDevices,StepChores,StepWindows,StepRemote}.tsx`, `frontend/src/v2/setup/starterChores.ts`, `frontend/tests/v2/setup.test.tsx`.

**Behaviour (spec §7.4):**
1. Family name and time zone, auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone` and editable as a searchable Select of `Intl.supportedValuesOf('timeZone')`.
2. Parent account: username, password ≥ 8 with show/hide, full name.
   - Calls `POST /setup`, stores the token through the existing auth (log in with the returned token), then continues.
   - A 409 shows "Setup is already done. Log in instead." with a link.
3. Add kids: name, avatar from 12 emoji, optional 4-digit PIN. `POST /kids`.
4. Devices: list `GET /devices`, polling every 5 s, with copy "Devices show up here once the box sees them on your Wi-Fi." Assign each to kid(s) or "Guest".
   - Empty list is allowed: "No devices yet — you can add them later from Devices."
   - Test block is NOT in this plan (Plan 2 adds it).
5. Starter chores: checkboxes from `starterChores.ts` (make bed, feed pet, homework, dishes, tidy room, brush teeth), each with points 10 and daily repeat, applied per kid. `POST /chores`.
6. Optional windows: an "Add bedtime" quick option creates `allowed` Mon–Sun 07:00–21:00 per kid via `POST /windows`. A "Skip" button is always visible.
7. Remote access: plain-language Tailscale steps, linking to `docs/remote-access.md` (Plan 4 writes it). "Finish" → `/`.

Progress shows as numbered sticker steps; this is a real sequence, so numbers are fine. Back and Next are on every step after 2. State is kept in the component and survives step changes. Steps 3–7 are skippable.

- [ ] Tests: renders step 1 with the detected time zone; password < 8 blocks Next with the message "Use at least 8 characters."; a 409 on setup shows the log-in link; skip on steps 3–7 reaches Finish. Mock `api` via `jest.mock('@/v2/api')`.
- [ ] Implement, gate, commit `feat(frontend): setup wizard`.

### Task 3: Parent Today `/` (parallel after T1)

**Files:** Modify `frontend/pages/index.tsx` (becomes Today, wrapped in `RequireParent` + `FridgeShell`). Create `frontend/src/v2/today/{TodayPage,KidCard,ChipRow,DeviceQuickMenu,NewDevicesBanner}.tsx`, `frontend/src/v2/hooks/useToday.ts`, `frontend/tests/v2/today.test.tsx`. Move the old `MyHub` page to `frontend/pages/hub.tsx` (same content, still behind the legacy `AuthGuard`).

**Behaviour (spec §9.2):**
- Header shows the day name. A yellow `Sticker` reads "{n} chore(s) need you" when `pending_approvals > 0`.
- `NewDevicesBanner` appears when `new_devices.length > 0`: "New device joined: {name}. Assign it?" → `/devices?focus={id}`.
- One `KidCard` per kid:
  - `LockBadge` (online_all).
  - Name, plus an Approve button when any chore is `needs_you`. It approves the first pending chore; a popover lists them all if there are several.
  - `ChipRow` of chores, then devices, collapsing per `collapseRow`.
- Tapping a `DevicePill` opens `DeviceQuickMenu`: Lock / Unlock with "for 30 min", "for 1 hour", "until I change it", and "Back to schedule" (DELETE override). These call `POST /devices/{id}/override` with `{action, minutes}`.
- Tapping the kid's LockBadge offers the same menu for all of that kid's devices (`/kids/{id}/override`).
- `useToday()` uses React Query key `['today']`, refetches every 15 s and on window focus. Mutations invalidate `['today']` and toast "Approved" / "Locked" / "Unlocked".
- Empty state with no kids: "Add your first kid to get started." → `/kids`.

- [ ] Tests: renders kids from a fixture; Approve calls `/chores/{id}/approve` and invalidates; 9 chores + 6 devices shows the summary and expands on click; device menu "Unlock for 1 hour" posts `{action:"unlock", minutes:60}`; empty state.
- [ ] Implement, gate, commit `feat(frontend): parent today screen`.

### Task 4: Kid screen `/kid` (parallel after T1)

**Files:** Create `frontend/pages/kid.tsx`, `frontend/src/v2/kid/{KidPage,KidPicker,PinPad,KidChecklist,UnlockedView}.tsx`, `frontend/src/v2/hooks/useKid.ts`, `frontend/tests/v2/kid.test.tsx`. No `RequireParent`. Uses kid auth only.

**Behaviour (spec §9.3; Review Focus 1–2):**
1. `GET /kid/whoami`.
   - `device:null` → "This device isn't set up yet. Ask a parent to add it."
   - One kid, no PIN → auto `POST /kid/login`.
   - One kid with a PIN → PinPad.
   - Two or more kids → KidPicker with big avatar buttons, then PinPad if `has_pin`.
2. Store the kid token in `localStorage['task4ce-kid-token']` with try/catch. A 401 on kid calls clears it and restarts at whoami.
3. Locked view:
   - Big red LockBadge, "Internet is paused", "Finish your chores to unlock."
   - `KidChecklist` rows: chore name, `+{points}`, state; "Waiting for Mom or Dad" for `needs_you`; a "Mark done" button for `todo`, which calls `POST /kid/chores/{id}/done`, then refetches and toasts "Marked done".
   - On a shared device, show each owner's list under their name. Use the KidPicker selection to choose whose list is interactive; other lists are read-only.
4. Unlocked view: green badge, "You're online", points balance, "{n} chores done today".
5. Refetch `/kid/today` every 10 s so the screen flips when a parent approves.
6. PinPad: 4 big digit buttons with keyboard support. A wrong PIN shows "Wrong PIN. Try again."; a 429 shows "Too many tries. Wait a minute and try again."

- [ ] Tests: unknown device message; single kid without PIN auto-logs in; two kids show the picker and never auto-pick; PIN wrong message; Mark done posts and refetches; locked → unlocked flip on data change.
- [ ] Implement, gate, commit `feat(frontend): kid lock screen`.

### Task 5: Manage screens — `/devices`, `/kids`, `/settings` (parallel after T1)

**Files:** Create `frontend/pages/{devices,kids,settings}.tsx`, `frontend/src/v2/manage/{DevicesPage,DeviceRow,GroupsPanel,KidsPage,KidEditor,ChoreList,ChoreEditor,SettingsPage,WindowEditor}.tsx`, `frontend/src/v2/hooks/{useDevices,useKids,useFamily,useWindows,useChores}.ts`, `frontend/tests/v2/manage.test.tsx`. All pages are wrapped in `RequireParent` and `FridgeShell`.

**Behaviour:**
- **Devices:**
  - Sections: "New (blocked until you assign them)", then "Assigned", then "Guests (always online)".
  - Each `DeviceRow` shows name (editable inline), vendor, last seen, owners (MultiSelect of kids), status, a Guest toggle, the quick lock menu (reused from T3's `DeviceQuickMenu`, imported from `@/v2/today/DeviceQuickMenu`), and Delete with confirmation.
  - `?focus={id}` scrolls to the row and highlights it.
  - `GroupsPanel`: create, rename and delete groups, set members, and lock/unlock a group.
- **Kids & chores:**
  - List of kids. `KidEditor` covers name, avatar, PIN set/clear and Delete with confirmation. Its copy: "Deleting {name} removes their chores and frees their devices."
  - `ChoreList` per kid shows today's chores and definitions. `ChoreEditor` has title, points (default 10), repeat (Every day / Weekdays / Pick days / Just today) and "Needs a photo" (stored only; photo proof is v2.1).
  - Uses `POST /chores`, `GET /chores/today` and `DELETE /chores/{definition_id}`.
- **Settings:**
  - Family name, time zone, reset time (`TimeInput`), "Block new devices until I assign them", and "Points can unlock early".
  - `WindowEditor` per kid and per group, with Allowed hours and Free time lists. Add a window with day toggles (Mon–Sun chips), start and end times. Overnight windows are allowed, with the hint "Ends the next morning".
  - Invite another parent: `POST /users/invite` shows the link with a copy button.
- Validation messages come from the backend `detail` (via `ApiError`).

- [ ] Tests: device assign owner PATCH payload; guest toggle; group create; chore editor "Weekdays" → `{"type":"weekly","days":[0,1,2,3,4]}`; window overnight hint shown when end < start; settings PATCH sends only changed fields.
- [ ] Implement, gate, commit `feat(frontend): devices, kids and settings screens`. If T3's `DeviceQuickMenu` isn't merged yet, build against the documented props `DeviceQuickMenu({targets: {kind:"device"|"kid"|"group", id:number}, label})` — T3 must export exactly this signature.

### Task 6: Login restyle, legacy cleanup, integration (after T2–T5 merge)

**Files:** Modify `frontend/pages/login.tsx` and `frontend/src/components/pages/auth/LoginPage.tsx` (fridge style; failed login shows the `detail` inline, never a thrown overlay; remove `console.error` on expected 401s; honour `?next=`), `frontend/src/components/auth/AuthGuard.tsx` (redirect to `/login?next=` instead of the inline login; remove the dead `/register` link), `frontend/pages/[...slug].tsx` (fridge 404: "That page doesn't exist." → Today), and `frontend/pages/test.tsx` (delete). Test `frontend/tests/v2/login.test.tsx`.

- [ ] Tests: wrong password shows "Incorrect username or password" inline; success with `?next=/devices` routes there.
- [ ] Gate plus `npm run build`. Run the dev instance (`docker compose -p task4ce-dev up -d --build frontend`) and smoke-check every route returns 200.
- [ ] Commit `feat(frontend): fridge login and route cleanup`.

---

**Parallelism:** T1 alone, then T2, T3, T4 and T5 in parallel worktrees (each resets to T1's head), cherry-picked back in order T3, T5, T2, T4, then T6. T3 owns `DeviceQuickMenu`; T5 imports it.
