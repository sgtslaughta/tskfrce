# v2 Project 7: Three polish passes, documentation, GitHub Pages site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three focused polish passes over the finished app, beginner-friendly documentation, and a modern, very easy GitHub Pages site for non-technical parents with a section for technical readers.

**Architecture:** Each polish pass is driven by evidence: Project 6's screenshots and journeys, plus a findings list written before any fix. Docs live in the repo as Markdown (`README.md`, `docs/guide/`, `docs/engineering.md`). The site is plain static HTML/CSS in `site/` (no build step, no framework), deployed by a GitHub Actions Pages workflow; it reuses the app's look (Space Grotesk/Inter, navy/sun/coral/green, fading grid) and real screenshots from the lab.

**Tech Stack:** HTML/CSS (Google Fonts), GitHub Actions `actions/upload-pages-artifact` + `actions/deploy-pages`.

**Specs:** both `docs/superpowers/specs/2026-10-21-*` docs; ADR `docs/adr/0001-blocker-enforcement-vs-firewalla.md`; `docs/blocker.md`, `docs/routers.md`, `lab/README.md`.

Prerequisite: Projects 1–6 merged into `feat/v2-teen-redesign`, lab e2e green.

## Global Constraints

- Site URL: `https://sgtslaughta.github.io/tskfrce/` (repo `sgtslaughta/tskfrce`). The README links to it near the top.
- Product name in user-facing text: **t@sk4ce**. The old "TaaskMaaster" README content is replaced, not kept.
- Parent-facing copy: plain words, short sentences, no jargon (no "ARP", "nftables", "container", "VLAN" outside the technical section and docs/engineering.md). Every instruction step is one action with what you should see next.
- Honest limits stated plainly (from the ADR and `docs/routers.md`): a determined kid can get around it (phone hotspot, changing network settings, another device); the app tells the parent when it notices; if the box is off, the internet just works (fails open).
- Site: one page plus `site/engineering.html`; works at 360 px with no sideways scroll; light and dark (`prefers-color-scheme`); text contrast ≥ 4.5:1; images have alt text; total page weight < 1.5 MB (compress screenshots to WebP/JPEG ≤ 200 KB each); no third-party scripts or trackers.
- Polish passes change no product behavior unless a pass finds a bug; each fix is its own commit with a test where it's logic.
- Publishing (pushing, enabling Pages) is **not** part of this plan: the owner does it or approves it separately.

- Owner bar (2026-10-21): "we have a lot of front end work to do (this should be a world-class app)". Polish passes are front-end heavy: every screen reviewed in a real browser (light/dark, 1280 px and 360 px) against the approved mockups, using the `frontend-design` skill; motion, empty/loading states, micro-interactions, typography rhythm and touch ergonomics get the same weight as bugs. Each pass ends with before/after screenshots the owner can review.

## Review Focus

1. **Jargon leak** into parent pages. (Task 5 check: grep the parent pages for a banned-word list.)
2. **Instructions that skip a step** a non-technical parent needs (where to plug the box in, what "open the app" means on a phone). (Task 4 review by reading it as a first-time parent.)
3. **Screenshots out of date** after polish changes. (Task 5 regenerates from the lab after the polish passes.)
4. **Dark mode on the site** unreadable. (Task 5 screenshot check.)
5. **Broken links** between README, docs and site. (Task 6 link check.)

---

### Task 1: Polish pass 1 — look and layout

- [ ] **Step 1:** Run the lab e2e (`bash scripts/lab.sh up && bash scripts/lab.sh e2e`) and review every screenshot, light/dark, desktop/phone. Write findings to `docs/superpowers/polish/pass-1.md` (screen, problem, fix), covering: spacing and alignment, inconsistent radii/shadows, leftover fridge-era visuals, truncation, empty states that look broken, tap targets < 44 px, focus visibility, animation jank.
- [ ] **Step 2:** Fix each finding (group small CSS fixes per screen into one commit each). Keep jest/type-check/lint green.
- [ ] **Step 3:** Re-run e2e; confirm each finding is resolved in the new screenshots; mark them done in `pass-1.md`.
- [ ] **Step 4:** Commit `style(frontend): polish pass 1 — layout and visuals`.

### Task 2: Polish pass 2 — words, errors, empty and loading states, accessibility

- [ ] **Step 1:** Findings to `docs/superpowers/polish/pass-2.md`: every user-facing string (frontend + backend `HTTPException` details) read for tone (plain, friendly, next step), consistency of names (chore/task, box/blocker → "home box"), empty states with a helpful next action, loading states (skeletons, no layout jump), error states (network down, box offline), and an accessibility sweep (labels, roles, `aria-live` for toasts and celebrations, keyboard paths through Today/Needs you, the chore editor, the Locker and the award overlay).
- [ ] **Step 2:** Fix; update tests that assert changed copy.
- [ ] **Step 3:** Commit `fix(ux): polish pass 2 — copy, states and accessibility`.

### Task 3: Polish pass 3 — performance, robustness, code cleanup

- [ ] **Step 1:** Findings to `docs/superpowers/polish/pass-3.md`: N+1 queries on `/today`, `/profiles`, `/leaderboard`, celebrations, chat threads (log query counts in a test with SQLAlchemy event hooks; target ≤ 15 queries per request for a 4-kid family); polling intervals and background-tab behavior; bundle size of the v2 routes (`next build` output); dead code from the fridge era and legacy screens no longer reachable from v2 (list, don't delete legacy `/hub` routes unless unused); run the `ponytail-audit` skill and take its high-value deletions; files near 500 lines.
- [ ] **Step 2:** Fix the worthwhile ones, with query-count regression tests for the endpoints touched.
- [ ] **Step 3:** Full suites + lab e2e green.
- [ ] **Step 4:** Commit `perf: polish pass 3 — queries, polling and cleanup`.

### Task 4: Documentation

**Files:**
- Rewrite: `README.md` (≤ 200 lines): what t@sk4ce is in two sentences, link to the site, screenshot, "Get started" (the 5 parent steps, linking to the guide), "For developers" (dev setup, tests, lab, link to engineering doc), license.
- Create: `docs/guide/README.md` (index), `docs/guide/01-what-you-need.md` (a Raspberry Pi 4/5 or an always-on computer, an ordinary home router — link `docs/routers.md` compatibility list), `02-install.md` (step by step, copy-paste commands with what you'll see; Docker install linked per OS), `03-first-setup.md` (setup wizard walkthrough with screenshots), `04-everyday-use.md` (approving chores, send back, screen time, rewards, badges, chat), `05-for-kids.md` (one page parents can show their kid), `06-troubleshooting.md` (box offline banner, a device isn't blocking, kid found a way around, resetting a PIN, backups), `07-faq.md`.
- Create: `docs/engineering.md`: architecture diagram (Mermaid: browser → Next.js → FastAPI → SQLite; blocker box with ARP/NDP redirection + nftables + captive portal; reconcile/push/heartbeat loops), enforcement model and its limits (link ADR), data model overview (chores/instances/participants/subtasks/photos, points ledger, redemptions, badges, threads), security notes (photo handling, token auth, kid PIN, internal token, fail-open), testing (unit, lab journeys, browser e2e, CI), repository map, how to add a badge or flair item.
- Update: `docs/blocker.md` and `lab/README.md` only where facts changed.

- [ ] **Step 1:** Write the docs; every command copy-pasted and run once in a clean checkout (or the lab) to confirm.
- [ ] **Step 2:** Screenshots from the lab e2e artifacts (post-polish) into `docs/guide/img/` (compressed).
- [ ] **Step 3:** Commit `docs: beginner guide, engineering overview and new README`.

### Task 5: GitHub Pages site

**Files:**
- Create: `site/index.html`, `site/styles.css`, `site/engineering.html`, `site/img/*` (compressed screenshots, a simple SVG of "chores → approve → internet back"), `site/favicon.svg`
- Create: `.github/workflows/pages.yml` (on push to `main` affecting `site/**` + `workflow_dispatch`; `permissions: pages: write, id-token: write`; upload `site/` and deploy)

`index.html` sections, in order: hero ("Chores first, then screens." + one-line explainer + "Get started" button to the guide + screenshot), **How it works** (three illustrated steps), **What kids see** (kid screen, levels, flair, rewards), **What parents see** (Today, Needs you, approvals), **Is it right for my family?** (needs, limits stated kindly and honestly), **Set it up in 20 minutes** (5 big numbered steps linking to the guide), **Privacy** (everything stays in your home; no accounts with us; no ads/trackers), **FAQ** (6–8 questions), footer (GitHub link, license, "For technical folks →" engineering page). `engineering.html`: condensed `docs/engineering.md` with the diagram as an inline SVG.

- [ ] **Step 1:** Build the pages to the Global Constraints; reuse the app's tokens and fonts.
- [ ] **Step 2:** Check: open both pages at 1280 px and 360 px, light and dark (Playwright screenshot script under `site/check.mjs` run in the lab's Playwright image, or locally); no sideways scroll; contrast spot-check; grep parent page for banned jargon (`ARP|nftables|NDP|container|Docker|VLAN|API`) → none outside the technical link.
- [ ] **Step 3:** Commit `docs(site): github pages site for parents and engineers`.

### Task 6: Link check and final docs review

- [ ] **Step 1:** Check every relative link in `README.md`, `docs/guide/*`, `docs/engineering.md`, `site/*.html` resolves (small script `scripts/check-links.py`, stdlib only).
- [ ] **Step 2:** A fresh reviewer reads the guide as a non-technical parent and lists every confusing step; fix them.
- [ ] **Step 3:** Commit `docs: fix links and clarify guide`.
