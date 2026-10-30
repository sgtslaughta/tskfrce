# v2 Project 7: Three polish passes, documentation, GitHub Pages site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three focused polish passes over the finished app, beginner-friendly documentation, and a modern, very easy GitHub Pages site for non-technical parents with a section for technical readers.

**Architecture:** Each polish pass is driven by evidence: Project 6's screenshots and journeys, plus a findings list written before any fix. Docs live in the repo as Markdown (`README.md`, `docs/guide/`, `docs/engineering.md`). The site is plain static HTML/CSS in `site/` (no build step, no framework), deployed by a GitHub Actions Pages workflow; it reuses the app's look (Space Grotesk/Inter, navy/sun/coral/green, fading grid) and real screenshots from the lab.

**Tech Stack:** HTML/CSS (Google Fonts), GitHub Actions `actions/upload-pages-artifact` + `actions/deploy-pages`.

**Specs:** both `docs/superpowers/specs/2026-10-21-*` docs; ADR `docs/adr/0001-blocker-enforcement-vs-firewalla.md`; `docs/blocker.md`, `docs/routers.md`, `lab/README.md`.

Prerequisite: Projects 1–6 merged into `feat/v2-teen-redesign`, lab e2e green.

## Global Constraints

- Site URL: `https://sgtslaughta.github.io/tskfrce/` (repo `sgtslaughta/tskfrce`). The README links to it near the top.
- Product name in user-facing text: **t@sk4ce**. The old pre-v2 README content is replaced, not kept.
- Parent-facing copy: plain words, short sentences, no jargon (no "ARP", "nftables", "container", "VLAN" outside the technical section and docs/engineering.md). Every instruction step is one action with what you should see next.
- Honest limits stated plainly (from the ADR and `docs/routers.md`): a determined kid can get around it (phone hotspot, changing network settings, another device); the app tells the parent when it notices; if the box is off, the internet just works (fails open).
- Site: one page plus `site/engineering.html`; works at 360 px with no sideways scroll; light and dark (`prefers-color-scheme`); text contrast ≥ 4.5:1; images have alt text; total page weight < 1.5 MB (compress screenshots to WebP/JPEG ≤ 200 KB each); no third-party scripts or trackers.
- Polish passes change no product behavior unless a pass finds a bug; each fix is its own commit with a test where it's logic.
- Publishing: owner approved publishing GitHub Pages (2026-10-21). Still confirm the exact push (branch/merge to `main`) with the owner before running it.
- Site = extension of the app (owner: "when a user clicks the link in the app, they should feel like they never left"): same top bar shape, fonts, tokens (light/dark incl. charcoal page + fading grid), gamer-cut buttons, card style and radii as the app; the app gets a "Help" link (top bar / settings) to the site, and the site's header has a "Back to t@sk4ce" affordance that returns to the app when opened from it (`?from=app` → `history.back()`, else hidden). Copy the app's CSS tokens into `site/styles.css` from the app source, don't re-invent them.

- Owner bar (2026-10-21): "we have a lot of front end work to do (this should be a world-class app)". Polish passes are front-end heavy: every screen reviewed in a real browser (light/dark, 1280 px and 360 px) against the approved mockups, using the `frontend-design` skill; motion, empty/loading states, micro-interactions, typography rhythm and touch ergonomics get the same weight as bugs. Each pass ends with before/after screenshots the owner can review.

## Review Focus

1. **Jargon leak** into parent pages. (Task 5 check: grep the parent pages for a banned-word list.)
2. **Instructions that skip a step** a non-technical parent needs (where to plug the box in, what "open the app" means on a phone). (Task 4 review by reading it as a first-time parent.)
3. **Screenshots out of date** after polish changes. (Task 5 regenerates from the lab after the polish passes.)
4. **Dark mode on the site** unreadable. (Task 5 screenshot check.)
5. **Broken links** between README, docs and site. (Task 6 link check.)

---

### Task 0: Easy install and account recovery (owner decisions 2026-10-22)

Owner picked: one-line installer; password reset both ways (another parent in the app, and a command on the box); license GPL-3.0.

**Files:**
- Create: `install.sh` (repo root; also published as `site/install.sh` in Task 5), `docker-compose.prod.yml`, `backend/app/cli.py`, `backend/app/models/password_reset.py`, `backend/app/api/password_reset.py`, alembic revision `password_resets`, `frontend/pages/reset.tsx`, tests `backend/tests/test_password_reset.py`, `frontend/tests/v2/reset.test.tsx`, `scripts/test-install.sh`
- Modify: `docker-compose.yml` (pass `INTERNAL_TOKEN` to backend too), blocker `PORTAL_REDIRECT_URL` default from `BOX_URL` (`http://<box>:3000/kid`), Settings → Parents (`frontend/src/v2/manage/InviteSection.tsx` or sibling: parent list + "Reset password" for other parents), `.env.example`, `scripts/start.sh`, `backend/README.md`, `frontend/package.json` name, `pyproject.toml` license → GPL-3.0 (match LICENSE text exactly: `GPL-3.0-only` or `-or-later`), `frontend/pages/api/proxy/[...path].ts` comment (backend cap is `MAX_UPLOAD_SIZE`, 10 MB), `.github/workflows/ci-cd.yml` (shellcheck + installer smoke test), guide pages `02-install.md`, `06-troubleshooting.md`, `07-faq.md`, `README.md`
- Create: `docs/remote-access.md` (the setup wizard links to it; Tailscale, beginner steps)

**Behavior:**
- `curl -fsSL https://sgtslaughta.github.io/tskfrce/install.sh | sh`: Linux only for the home box (Raspberry Pi OS / Debian / Ubuntu, arm64 + amd64; other OS → friendly message). Asks before installing Docker (official `get.docker.com`) if missing. Installs to `~/task4ce` (env `TASK4CE_DIR` overrides): downloads the repo tarball of the release branch (env `TASK4CE_REF`, default `main`; `TASK4CE_SRC=<path>` uses a local checkout for tests), writes `.env` once with generated `SECRET_KEY` and `INTERNAL_TOKEN` (`openssl rand -hex 32`, fallback `/dev/urandom`) and `BOX_URL=http://<primary LAN IP>:3000`, runs `docker compose -f docker-compose.prod.yml up -d --build`, waits for health (≤ 180 s), prints one friendly block: "t@sk4ce is running. Open http://<ip>:3000 on your phone or computer." Re-running = update (keeps `.env` and data volume). Plain-English output, no stack traces; every failure says what to do next. POSIX `sh`, passes `shellcheck`.
- `docker-compose.prod.yml`: no source bind mounts, production builds/targets, `restart: unless-stopped`, named data volume, same `INTERNAL_TOKEN` to backend and blocker, blocker `network_mode: host` as today.
- Password reset: table `password_resets` (id, user_id → users cascade, token_hash String(64) unique, created_by_id → users nullable, expires_at, used_at nullable); token = 32 random bytes urlsafe, stored as sha256 hex; valid 30 min, single use; creating a new one voids older unused ones for that user. `POST /api/v1/parents/{id}/reset-link` (parent only, target must be another parent, not self) → `{url}` (`<BOX_URL or request origin>/reset?token=…`). `python -m app.cli reset-password <username>` (run as `docker compose exec backend python -m app.cli reset-password <name>`; prints the link; lists parent usernames if the name is wrong). `POST /api/v1/auth/reset {token, password}` (public, rate limited like login, password rules as register) → 204; bad/expired/used → 400 "That reset link has expired. Ask for a new one." Reset revokes the user's refresh tokens if the app stores them. Kids are not reset this way (parents change kid PINs already).
- Settings → Parents lists parents (name, "you"); other parents get "Reset password" → shows the link with Copy and "Send this to <name>. It works once, for 30 minutes."
- `/reset` page: two password fields, show/hide, plain errors, success → login.

- [ ] **Step 1: Failing tests:** reset token single-use, expiry, hash-only storage, voiding older links, self-reset forbidden (403), kid caller 403, CLI prints link for valid parent and lists names for an unknown one, `/auth/reset` bad token 400 + rate limit; frontend reset page validation + success redirect, Parents list + copy link. `scripts/test-install.sh`: runs `install.sh` with `TASK4CE_SRC=$PWD TASK4CE_DIR=$(mktemp -d)` in CI (Docker available) and asserts health + `.env` has both secrets; second run keeps `.env` unchanged.
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4:** full suites + ruff + shellcheck + `scripts/test-install.sh` locally → PASS.
- [ ] **Step 5: Commit** `feat: one-line installer and password reset` (split into commits per area if cleaner).

### Task 1: Polish pass 1 — look and layout

- [ ] **Step 1:** Run the lab e2e (`bash scripts/lab.sh up && bash scripts/lab.sh e2e`) and review every screenshot, light/dark, desktop/phone. Write findings to `docs/superpowers/polish/pass-1.md` (screen, problem, fix), covering: spacing and alignment, inconsistent radii/shadows, leftover fridge-era visuals, truncation, empty states that look broken, tap targets < 44 px, focus visibility, animation jank.
- [ ] **Step 2:** Fix each finding (group small CSS fixes per screen into one commit each). Keep jest/type-check/lint green.
- [ ] **Step 3:** Re-run e2e; confirm each finding is resolved in the new screenshots; mark them done in `pass-1.md`.
- [ ] **Step 4:** Commit `style(frontend): polish pass 1 — layout and visuals`.

### Task 2: Polish pass 2 — words, errors, empty and loading states, accessibility

- [ ] **Step 0 (owner-side review of pass 1, 2026-10-22):** also fix these, with before/after screenshots:
  1. Kid home: per-row "Chat" buttons are heavy and repeated → one quiet icon button with unread dot per chore; "Waiting for Mom or Dad" becomes the row's status chip (like parent Today), not a loose line; disabled "Mark done" must read as a real disabled button with the reason ("Add a photo first"), not a dashed placeholder; empty "Rewards · 0 points" card needs a friendly empty state with the next step; "Family" heading belongs inside its card.
  2. Phone: floating chat button overlaps content (kid tabs, last item) → reserve bottom space (`padding-bottom` ≥ launcher + 16 px) on every page and keep the launcher clear of tab bars; device pills show a friendly short name (strip lab/host prefixes and domain, title case, max ~14 chars + ellipsis, full name in title/aria).
  3. Top bar: "Log out" moves into a small account menu (avatar/name → Help, Settings, Log out); theme toggle stays.
  4. Today "Chat with <kid>": show the latest message across that kid's threads (private + their chore threads) with sender and time, or "Say hi to <kid>" with a composer shortcut when empty; never "No messages yet." beside unread badges.
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
