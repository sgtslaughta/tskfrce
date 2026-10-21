# v2 Redesign Project 1: New Look — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin every v2 screen (parent, kid, login, register, setup) to the approved teen look, light and dark, with no behavior change.

**Architecture:** Keep the existing token + class system (`src/v2/fridge.css`, `.f-*` classes, `fridgeTheme`) and change values, not structure. Fonts swap in `fonts.ts`/`_app.tsx`. Form controls get the "gamer-cut" style through Mantine `theme.components` classNames pointing at a new `src/v2/controls.css`. Kid cards become two-tone (header + body) via two new classes.

**Tech Stack:** Next.js pages router, Mantine 7, `next/font/google`, plain CSS, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-21-v2-teen-redesign-gamification-design.md` (section "1. New look"). Mockups with exact CSS: `docs/superpowers/specs/2026-10-21-v2-teen-redesign-mockups/theme-final.html` (page, cards, grid, nav) and `controls.html` option C (`.vc` rules = gamer-cut).

Work in worktree `/home/user/code/tskfrce-redesign`, branch `feat/v2-teen-redesign`. Frontend commands run from `frontend/`.

## Global Constraints

- No behavior change: no API, hook, route or copy changes (tests asserting text must keep passing unchanged).
- Fonts: Space Grotesk (display: headings, names, nav, buttons, wordmark), Inter (body), JetBrains Mono (point/XP/number readouts). Remove Fredoka and Nunito everywhere in `src/v2`, `pages/_app.tsx`.
- Palette kept: navy `#1d2b53`, sun `#ffc93c`, red `#ff6b4a`, green `#7bd389` (dark-mode red `#ff7a5c`, green `#6fd08a` stay).
- Light: page `#f4f7fa`, card `#ffffff`. Dark: page `#1e2026` (neutral charcoal), card body `#18213f` (navy).
- Cards: no outline, soft shadow, 8px radius. Light shadow `0 1px 2px rgba(29,43,83,.06), 0 6px 20px rgba(29,43,83,.08)`; dark `0 6px 20px rgba(0,0,0,.45)`.
- Kid card header — light: navy bg, white text, sun points; dark: `#e8eeff` bg, navy text, `4px solid #ffc93c` top border. XP/progress bars: `linear-gradient(90deg,#ffc93c,#ffb020)`.
- Background grid: 24px square lines, light `rgba(29,43,83,.12)`, dark `rgba(255,255,255,.08)`, masked `radial-gradient(ellipse at 50% 0%, #000 10%, transparent 75%)` so it fades top→bottom.
- Small labels, nav links, tags, buttons: uppercase, letter-spacing `.06em–.08em`, 11–12px, weight 600–700. Active nav: text color + `2px solid` sun underline.
- Gamer-cut controls: inputs 1.5px border, 4px radius; focus = strong border + `3px 3px 0 #ffc93c` shadow. Primary/secondary buttons cut corners via `clip-path: polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))`. Danger = red text button.
- Touch targets stay ≥ 44px (existing `min-height: 44px` rules keep).
- Animations respect `prefers-reduced-motion` (existing block in `fridge.css` keeps).
- Files < 500 lines. CI: `npm run lint`, `npm run type-check`, `npx jest`.

## Review Focus

1. **Keyboard focus on cut-corner buttons:** `clip-path` clips `outline`, so a focused button could show no ring. Expected: visible focus on every button in both modes. (Test in Task 3.)
2. **Mantine portals (Menu, Drawer, Modal, Notifications, Select dropdowns):** render outside `.f-shell`. Expected: dark mode tokens and fonts still apply. Tokens must stay on `:root`/`[data-mantine-color-scheme]`, never scoped to `.f-shell`. (Test in Task 1.)
3. **Dark-mode contrast:** yellow text on the pale `#e8eeff` header is unreadable. Expected: header points/name are navy in dark mode; sun only for bars/stripe. (Test in Task 2.)
4. **Phone width (360px):** two-column grids and nav must not cause horizontal scroll. Expected: no page-level horizontal scroll at 360px on any route. (Checked in Task 4 QA.)
5. **Pages outside FridgeShell** (login, register, setup, kid): expected to get the same background, grid and fonts. (Checked in Task 4 QA.)

---

### Task 1: Fonts, tokens, page background, top bar

**Files:**
- Modify: `frontend/src/v2/fonts.ts`
- Modify: `frontend/pages/_app.tsx:115-121` (font CSS variables)
- Modify: `frontend/src/v2/theme.ts` (fontFamily, headings, radius)
- Modify: `frontend/src/v2/fridge.css` (tokens, `.f-shell`, `.f-bar`, `.f-wordmark`, `.f-day`, `.f-nav`, `.f-title-row`, `.f-btn` font)
- Test: `frontend/tests/v2/fridgeCss.test.ts`, new `frontend/tests/v2/theme.test.ts`

**Interfaces:**
- Produces: exports `display`, `body`, `mono` from `src/v2/fonts.ts` (replacing `fredoka`, `nunito`); CSS vars `--font-display`, `--font-body`, `--font-mono` on `:root`. New tokens in both schemes: `--f-grid`, `--f-shadow`, `--f-head-bg`, `--f-head-ink`, `--f-head-sub`, `--f-head-stripe`, `--f-field`, `--f-edge`. Existing token names keep their meaning (`--f-bg`, `--f-card`, `--f-ink`, `--f-sub`, `--f-mute`, `--f-line`, `--f-sun`, `--f-red`, `--f-green`, `--f-on-color`).

Token values (light / dark):

| token | light | dark |
|---|---|---|
| `--f-bg` | `#f4f7fa` | `#1e2026` |
| `--f-card` | `#ffffff` | `#18213f` |
| `--f-ink` | `#1d2b53` | `#e8eeff` |
| `--f-sub` | `#4a5a80` | `#8f9cc4` |
| `--f-mute` | `#eef1f6` | `#232f57` |
| `--f-line` | `#eef1f6` | `#232f57` |
| `--f-grid` | `rgba(29,43,83,.12)` | `rgba(255,255,255,.08)` |
| `--f-head-bg` | `#1d2b53` | `#e8eeff` |
| `--f-head-ink` | `#ffffff` | `#1d2b53` |
| `--f-head-sub` | `#c6d0ee` | `#4a5a80` |
| `--f-head-stripe` | `transparent` | `#ffc93c` |
| `--f-field` | `#ffffff` | `#101833` |
| `--f-edge` | `#c9d3e6` | `#34416b` |

`--f-shadow`: values from Global Constraints. `--f-line` now means "divider", no longer "outline".

- [ ] **Step 1: Write failing tests**

In `tests/v2/fridgeCss.test.ts` add:
```ts
const css = readFileSync(join(__dirname, '../../src/v2/fridge.css'), 'utf8')
test('no fridge fonts remain', () => {
  expect(css).not.toMatch(/Fredoka|Nunito/)
})
test('dark page is charcoal and card body navy', () => {
  const dark = css.slice(css.indexOf("[data-mantine-color-scheme='dark']"))
  expect(dark).toMatch(/--f-bg:\s*#1e2026/)
  expect(dark).toMatch(/--f-card:\s*#18213f/)
})
test('tokens are not scoped to .f-shell (portals need them)', () => {
  expect(css).not.toMatch(/\.f-shell\s*\{[^}]*--f-bg/)
})
test('page grid fades with a mask', () => {
  expect(css).toMatch(/\.f-shell::before[^}]*mask-image:\s*radial-gradient/)
})
```
New `tests/v2/theme.test.ts`:
```ts
import { expect, test } from '@jest/globals'
import { fridgeTheme } from '@/v2/theme'
test('theme uses the new font stack', () => {
  expect(fridgeTheme.fontFamily).toContain('Inter')
  expect(fridgeTheme.headings?.fontFamily).toContain('Space Grotesk')
  expect(JSON.stringify(fridgeTheme)).not.toMatch(/Fredoka|Nunito/)
})
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npx jest tests/v2/fridgeCss.test.ts tests/v2/theme.test.ts`
Expected: the 5 new tests fail.

- [ ] **Step 3: Swap fonts**

`fonts.ts`: `Space_Grotesk` (weights 500, 700) → `display`, `Inter` (400, 500, 600) → `body`, `JetBrains_Mono` (500, 700) → `mono`, all `subsets: ['latin'], display: 'swap'`, variables `--font-display`, `--font-body`, `--font-mono`. `_app.tsx`: set all three vars from `.style.fontFamily`. `theme.ts`: `fontFamily: 'var(--font-body), Inter, system-ui, sans-serif'`, headings `'var(--font-display), "Space Grotesk", system-ui, sans-serif'` weight `'700'`, `radius: { md: '8px', lg: '8px' }`, `defaultRadius: 'md'`. Add `fontFamilyMonospace: 'var(--font-mono), "JetBrains Mono", monospace'`.

- [ ] **Step 4: Tokens, page and bar in `fridge.css`**

Replace token blocks with the table above. `.f-shell`: `position: relative; background-color: var(--f-bg)`; body font Inter stack. Add `.f-shell::before` (position fixed, inset 0, `pointer-events: none`, `z-index: 0`) with the grid (two `linear-gradient`s of `var(--f-grid)` 1px, `background-size: 24px 24px`) and the mask from Global Constraints; `.f-shell > *` gets `position: relative; z-index: 1`. Display font stack everywhere Fredoka was. `.f-bar`: background transparent, no border, `border-bottom: 1px solid var(--f-line)`. `.f-nav a`: uppercase, `letter-spacing: .08em`, 12px, weight 600, color `var(--f-sub)`, no radius; `[aria-current='page']`: color `var(--f-ink)`, background none, no border, `box-shadow: inset 0 -2px 0 var(--f-sun)`. Add utility `.f-num { font-family: var(--font-mono), 'JetBrains Mono', monospace; font-weight: 700; }` and `.f-cap { text-transform: uppercase; letter-spacing: .08em; font-size: 11px; font-weight: 600; }`.

- [ ] **Step 5: Run tests, expect PASS; then full suite**

Run: `npx jest && npm run type-check && npm run lint`
Expected: all pass (existing text assertions unchanged).

- [ ] **Step 6: Commit**
```bash
git add frontend/src/v2/fonts.ts frontend/pages/_app.tsx frontend/src/v2/theme.ts frontend/src/v2/fridge.css frontend/tests/v2/fridgeCss.test.ts frontend/tests/v2/theme.test.ts
git commit -m "feat(frontend): teen fonts, tokens and grid background"
```

---

### Task 2: Soft cards, two-tone kid card, tags, chips, pills

**Files:**
- Modify: `frontend/src/v2/fridge.css` (`.f-card`, tones, `.f-sticker`, `.f-lock`, `.f-chip`, `.f-pill`)
- Modify: `frontend/src/v2/today/KidCard.tsx` (wrap name/badge/points in header)
- Modify: `frontend/src/v2/kid/KidPage.tsx` and `frontend/src/v2/kid/UnlockedView.tsx` (points readout uses `.f-num`)
- Test: `frontend/tests/v2/fridgeCss.test.ts`, `frontend/tests/v2/today.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: classes `.f-card-head` and `.f-card-body` (children of `.f-card`; `.f-card` gets `padding: 0; overflow: hidden` when it has a head — use `.f-card:has(> .f-card-head)` or a `data-split` attribute, implementer's choice). `StickerCard` API unchanged.

- [ ] **Step 1: Write failing tests**

`fridgeCss.test.ts`:
```ts
test('cards have no outline and 8px corners', () => {
  const card = css.match(/\.f-card\s*\{[^}]*\}/)![0]
  expect(card).not.toMatch(/border:\s*3px/)
  expect(card).toMatch(/border-radius:\s*8px/)
  expect(card).toMatch(/box-shadow:\s*var\(--f-shadow\)/)
})
test('card head uses head tokens and dark stripe', () => {
  const head = css.match(/\.f-card-head\s*\{[^}]*\}/)![0]
  expect(head).toMatch(/background:\s*var\(--f-head-bg\)/)
  expect(head).toMatch(/color:\s*var\(--f-head-ink\)/)
  expect(head).toMatch(/border-top:\s*4px solid var\(--f-head-stripe\)/)
})
test('sticker tag no longer rotates', () => {
  expect(css).not.toMatch(/rotate\(-2deg\)/)
})
```
`today.test.tsx`, inside `describe("TodayPage")`:
```ts
test("kid name sits in the card header", async () => {
  renderPage(base);
  const name = await screen.findByText("Emma");
  expect(name.closest(".f-card-head")).not.toBeNull();
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npx jest tests/v2/fridgeCss.test.ts tests/v2/today.test.tsx`

- [ ] **Step 3: Restyle in `fridge.css`**

`.f-card`: `border: none; border-radius: 8px; box-shadow: var(--f-shadow); background: var(--f-card); padding: 14px`. Tone variants keep colors but get `border-top: 4px solid` of the tone color on a `var(--f-card)` background instead of a full fill (sun/red/green fills read childish); `[data-tone='mute']` → `background: var(--f-mute)`. `.f-card-head`: head tokens, `padding: 12px 14px`, `border-top: 4px solid var(--f-head-stripe)`; points inside it use `.f-num` with `color: var(--f-sun)` in light and `var(--f-head-ink)` in dark (put the dark override under `[data-mantine-color-scheme='dark'] .f-card-head .f-num`). `.f-card-body`: `padding: 4px 14px 14px`. `.f-sticker`: uppercase `.f-cap` look, `border: none`, `border-radius: 4px`, `padding: 2px 8px`, background `rgba(255,201,60,.18)`, color `var(--f-ink)`, no transform. `.f-lock`, `.f-chip`, `.f-pill`: borders `1.5px solid var(--f-edge)`; chips `border-radius: 3px`; pills `border-radius: 4px`, uppercase 11px; keep their state colors.

- [ ] **Step 4: Two-tone KidCard**

In `KidCard.tsx`, put the lock badge, name and any points/status into `<div className="f-card-head">`, the Approve button and `ChipRow` into `<div className="f-card-body">`. Name uses the display font at 20px. No logic changes.

- [ ] **Step 5: Kid points readout**

In `UnlockedView.tsx` (and wherever `KidPage` shows points), wrap the number in `<span className="f-num">`. Text content must stay identical (tests match it).

- [ ] **Step 6: Run full suite, expect PASS**

Run: `npx jest && npm run type-check && npm run lint`

- [ ] **Step 7: Commit**
```bash
git add frontend/src/v2 frontend/tests/v2
git commit -m "feat(frontend): soft two-tone cards and quieter tags"
```

---

### Task 3: Gamer-cut form controls

**Files:**
- Create: `frontend/src/v2/controls.css`
- Modify: `frontend/src/v2/theme.ts` (`components` classNames)
- Modify: `frontend/pages/_app.tsx` (import `controls.css` next to `fridge.css`)
- Modify: `frontend/src/v2/fridge.css` (remove `.f-btn` rules that move to controls.css)
- Test: `frontend/tests/v2/theme.test.ts`, new `frontend/tests/v2/controlsCss.test.ts`

**Interfaces:**
- Consumes: Task 1 tokens `--f-field`, `--f-edge`, `--f-ink`, `--f-sun`, `--f-red`.
- Produces: classNames `f-btn` (Button root), `f-input` (Input input), `f-label` (InputWrapper label), `f-seg` (SegmentedControl root), `f-switch` (Switch track), `f-check` (Checkbox input), `f-chipctl` (Chip label). Button variants by Mantine's `data-variant` attribute: `filled` = primary (sun), `default`/`light` = secondary (`var(--f-edge)` fill), `subtle` = danger/text (`var(--f-red)` text when `color="red"`, else `var(--f-ink)`).

- [ ] **Step 1: Write failing tests**

`theme.test.ts`:
```ts
test('controls get gamer-cut classNames', () => {
  const c = fridgeTheme.components!
  expect(c.Button.classNames).toMatchObject({ root: 'f-btn' })
  expect(c.Input.classNames).toMatchObject({ input: 'f-input' })
  expect(c.InputWrapper.classNames).toMatchObject({ label: 'f-label' })
  expect(c.SegmentedControl.classNames).toMatchObject({ root: 'f-seg' })
  expect(c.Switch.classNames).toMatchObject({ track: 'f-switch' })
  expect(c.Checkbox.classNames).toMatchObject({ input: 'f-check' })
  expect(c.Chip.classNames).toMatchObject({ label: 'f-chipctl' })
})
```
`controlsCss.test.ts`:
```ts
import { expect, test } from '@jest/globals'
import { readFileSync } from 'fs'
import { join } from 'path'
const css = readFileSync(join(__dirname, '../../src/v2/controls.css'), 'utf8')
test('buttons are cut-corner', () => {
  expect(css).toMatch(/\.f-btn[^{]*\{[^}]*clip-path:\s*polygon/)
})
test('focused inputs get the yellow offset shadow', () => {
  expect(css).toMatch(/\.f-input:focus[^{]*\{[^}]*box-shadow:\s*3px 3px 0 var\(--f-sun\)/)
})
test('focused buttons show a ring that clip-path cannot hide', () => {
  const rule = css.match(/\.f-btn:focus-visible[^{]*\{[^}]*\}/)![0]
  expect(rule).toMatch(/clip-path:\s*none|inset/)
})
test('touch targets stay 44px', () => {
  expect(css).toMatch(/\.f-btn[^{]*\{[^}]*min-height:\s*44px/)
  expect(css).toMatch(/\.f-input[^{]*\{[^}]*min-height:\s*44px/)
})
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npx jest tests/v2/theme.test.ts tests/v2/controlsCss.test.ts`

- [ ] **Step 3: Write `controls.css`**

Port `controls.html` `.vc` rules onto the classNames above using tokens. Buttons: display font, uppercase, `letter-spacing: .06em`, 12px, weight 700, `min-height: 44px`, the clip-path polygon, `border: none`. Focus: on `.f-btn:focus-visible` set `clip-path: none; border-radius: 4px; outline: 3px solid var(--f-sun); outline-offset: 2px` (dropping the cut while focused keeps the ring fully visible). Inputs: `background: var(--f-field); border: 1.5px solid var(--f-edge); border-radius: 4px; min-height: 44px`; `:focus`/`:focus-within` → `border-color: var(--f-ink); box-shadow: 3px 3px 0 var(--f-sun)`. Labels: `.f-cap` look in `var(--f-sub)`. Segmented: `1.5px solid var(--f-edge)`, active indicator `var(--f-ink)` with `var(--f-card)` text. Switch track checked: `var(--f-green)`. Checkbox: 3px radius, checked `var(--f-green)`. Chip label: 4px radius, checked `var(--f-ink)` bg. Disabled: `opacity: .5`. Mantine classes are applied in addition to its own, so use enough specificity (e.g. `.f-btn.f-btn`) where Mantine's defaults win — verify visually.

- [ ] **Step 4: Wire theme + import**

`theme.ts` `components`: `Button`, `Input`, `InputWrapper`, `SegmentedControl`, `Switch`, `Checkbox`, `Chip` with the classNames above (`Button` keeps `defaultProps` nothing else). `_app.tsx`: `import '@/v2/controls.css'` beside the existing `fridge.css` import.

- [ ] **Step 5: Run full suite, expect PASS**

Run: `npx jest && npm run type-check && npm run lint`

- [ ] **Step 6: Commit**
```bash
git add frontend/src/v2/controls.css frontend/src/v2/theme.ts frontend/pages/_app.tsx frontend/src/v2/fridge.css frontend/tests/v2
git commit -m "feat(frontend): gamer-cut buttons and inputs"
```

---

### Task 4: Every route, both modes — visual QA and fixes

**Files:**
- Modify: whatever the QA finds (expected: inline `style={{...}}` in `src/v2/**` that hard-codes old radii, borders, `fontSize`, or colors; `pages/login.tsx`, `register.tsx`, `setup.tsx`, `kid.tsx` roots).

**Interfaces:**
- Consumes: everything from Tasks 1–3.

- [ ] **Step 1: Find leftovers**

Run: `grep -rnE "Fredoka|Nunito|3px solid|border-radius: ?1[28]px|rotate\(" frontend/src/v2 frontend/pages/*.tsx`
Expected after fixes: no hits (except unrelated legacy pages under `src/components`, which are out of scope).

- [ ] **Step 2: Run the app and screenshot**

Use the `run` skill (or `npm run dev` + browser) against the dev instance. Visit `/`, `/devices`, `/kids`, `/settings`, `/login`, `/register`, `/setup`, `/kid` in light and dark, at 1280px and 360px. Open one Menu (kid card lock menu), the mobile Drawer, a Select dropdown, and trigger a toast in dark mode.
Expected: grid background fades on every route; no Fredoka/Nunito; dark kid card header pale with yellow stripe and navy body; portals dark in dark mode; no horizontal scroll at 360px; every button and input shows a visible focus ring when tabbed to.

- [ ] **Step 3: Fix what Step 2 shows**

Move hard-coded inline visuals to tokens/classes. Wrap any v2 page root missing `.f-shell` (login/register/setup) so they get the background and fonts. Behavior and copy unchanged.

- [ ] **Step 4: Full CI check**

Run: `npx jest && npm run type-check && npm run lint`
Expected: all pass, no new lint warnings.

- [ ] **Step 5: Commit**
```bash
git add frontend
git commit -m "fix(frontend): apply new look to every v2 route"
```
