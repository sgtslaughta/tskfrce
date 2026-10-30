# t@sk4ce engineering overview

For contributors. Parents: start with the [guide](guide/README.md).

## Architecture

```mermaid
flowchart LR
  subgraph Clients
    P[Parent browser]
    K[Kid browser]
  end
  subgraph Box["Home box (Linux, same LAN)"]
    FE["Next.js frontend :3000<br/>/api/proxy/* (12 MB body cap)"]
    BE["FastAPI backend :8000<br/>lock loop, services"]
    DB[("SQLite + uploads<br/>DATA_DIR volume")]
    NTFY["ntfy :2586<br/>kid phone alerts"]
    subgraph BL["blocker (host network, NET_ADMIN/NET_RAW)"]
      DISC[discovery: ARP/NDP scan]
      RED[ARP/NDP redirection]
      NFT[nftables drop]
      PORT[captive portal: DNS :53, HTTP :80]
      RES[resistance detector]
    end
  end
  R[Home router]
  P --> FE
  K --> FE
  FE -->|"/api/v1/*"| BE
  BE --- DB
  BE -->|"push blocked MACs POST /state (every 30 s + on change)"| BL
  BL -->|"reconcile: GET /internal/state (30 s)"| BE
  BE -->|"kid alerts"| NTFY
  DISC -->|"POST /internal/devices/seen (20 s)"| BE
  RES -->|"POST /internal/devices/resisting (15 s)"| BE
  RED -.->|spoofs gateway and device| R
```

Heartbeat: the blocker's calls to `/internal/*` stamp `family_settings.blocker_last_seen`. The app calls the box offline after 90 seconds without a beat (`BLOCKER_STALE` in `backend/app/api/devices.py`) and the UI shows a banner.

Two loops decide who is blocked:

- **Lock loop** (`backend/app/lock/loop.py`, every `LOCK_INTERVAL_SECONDS`, default 30, or immediately via `trigger()`): `lock/state.py:desired_blocked` runs `lock/rules.py:block_reason` for every device and sends the blocked MAC list to the blocker (`lock/blocker_client.py`).
- **Reconcile** (`blocker/service.py`): the blocker also pulls `GET /internal/state` and maps blocked MACs to currently known IPv4/IPv6 addresses, then applies redirects and firewall rules. It holds no policy.

### Is a device online? (`backend/app/lock/rules.py`, `lock/hours.py`)

`block_reason` checks in this order and returns the first match (`None` means online):

1. A manual `lock` override blocks.
2. Guests are online.
3. Unassigned (new) devices are blocked unless the family setting `new_devices_blocked` is off (it is on by default) or a parent unlocked the device.
4. `exempt` devices are online.
5. A manual `unlock` override is online.
6. A bonus (screen time) override that allows any hours opens the device, but never inside an internet-off window.
7. Outside allowed hours, or inside an "off" window: blocked (`schedule`).
8. Online if every owner's chores for today are approved (or they have none), or a free window is open, or a bonus override is active and `points_unlock_early` is on. Otherwise blocked (`chores`). A family or group setting can switch the chore check off (`chores_apply`).

Hours come from `hour_rules` (kinds `allowed`, `free`, `off`; categories holiday, summer, weekend, school_night, other). `hours.resolve` picks the rules in force per kid, group and Everyone: Holiday or Summer rules replace everyday ones, and the best category wins within a target. A kid with rules in range but none for today is blocked all day (fail closed). Overnight windows continue into the next morning.

## Enforcement model and limits

The box redirects a blocked device's traffic to itself with ARP (IPv4) and NDP (IPv6), spoofing both directions (the device thinks the gateway is the box, the router thinks the device is the box), drops internet-bound packets with nftables, and serves a captive portal (DNS answers with the box address; HTTP 302 to `PORTAL_REDIRECT_URL`). It fails open: if the box dies, devices return online.

New devices are blocked by default, so a device that appears (including one with a new private Wi-Fi address) starts paused until a parent assigns it. Honest limits: hotspots, cellular and unregistered devices are out of scope. Routers with ARP inspection or client isolation can defeat it. A device that keeps getting traffic through is flagged `resisting`, and parents get a notification.

Reasoning, comparison with Firewalla and the lab finding behind the bidirectional design: [ADR 0001](adr/0001-blocker-enforcement-vs-firewalla.md). Operator view: [blocker.md](blocker.md). Router compatibility: [routers.md](routers.md).

## Data model

Defined in `backend/app/models/`, migrated with Alembic (`backend/alembic`). Full design and migration rules: [relational schema spec](superpowers/specs/2026-10-21-v2-relational-schema-design.md). SQLite runs with `PRAGMA foreign_keys=ON`. Closed value sets have CHECK constraints.

```mermaid
erDiagram
  chores ||--o{ chore_steps : has
  chores ||--o{ chore_assignments : "assigned via"
  chore_assignments ||--o{ assignment_kids : for
  users ||--o{ assignment_kids : kid
  chore_assignments ||--o{ chore_runs : generates
  chore_runs ||--o{ run_kids : "shared run participants"
  chore_runs ||--o{ run_step_ticks : ticks
  chore_steps ||--o{ run_step_ticks : "ticked step"
  chore_runs ||--o{ chore_photos : proof
  chore_runs ||--o{ threads : "kind=chore"
  chore_runs ||--o{ points : "ledger"
  redemptions ||--o{ points : "ledger"
  users ||--o{ points : earns
  users ||--o{ badge_awards : earns
  custom_badges ||--o{ badge_awards : "custom FK"
  users ||--o{ kid_flair : equips
  users ||--o{ notifications : receives
  devices ||--o{ device_ipv6 : addresses
  threads ||--o{ thread_messages : has
```

| Group | Tables | Notes |
|---|---|---|
| Chore library | `chores`, `chore_steps`, `chore_types`, `chore_type_notes` | A chore is reusable. There is no archive: `DELETE /api/v1/chores/{id}` hard-deletes the chore with its assignments, runs, step ticks, proof photos (files too) and chat. Points already earned or taken stay in balances, detached from the run. |
| Who and when | `chore_assignments`, `assignment_kids` | `mode` each / race / team; `repeat` daily / weekly / once; `days` is a digit string (`"024"` = Mon, Wed, Fri). |
| Today's work | `chore_runs`, `run_kids`, `run_step_ticks` | Runs read title, points and steps live from the chore. `kid_id` NULL means a shared (race/team) run, with participants in `run_kids`. Status `todo`, `submitted`, `done`, `cancelled`, `skipped`; `attempt` counts send-backs. Partial unique indexes stop double generation. |
| Proof and chat | `chore_photos`, `threads`, `thread_messages`, `message_reactions`, `thread_reads`, `chat_photos` | Thread kinds `chore` (run id), `private` (kid id), `family`. |
| Economy | `points`, `rewards`, `redemptions` | `points` is the ledger: signed amount, `reason` (chore, early_bonus, team_share, redemption, bonus, adjustment, deduction), optional `run_id` or `redemption_id` (at most one). `redemptions` kind `screen_time` or `reward`, status pending / approved / denied. |
| Progression | `badge_awards`, `custom_badges`, `kid_flair` | `badge_awards` has `badge_key` (built-in) or `custom_badge_id` (FK), exactly one set. `kid_flair` PK (kid, slot). XP, levels and streaks are derived from the ledger and runs, not stored. |
| Inbox | `notifications` | One row per recipient, written with the event; nullable FKs to run, redemption, device, thread. |
| Network | `devices`, `device_ipv6`, `device_groups`, `overrides`, `device_events`, `device_presence`, `screen_time_limits` | `devices.status` unassigned / assigned / guest. `overrides` action lock or unlock, source manual or bonus. |
| Hours | `hour_rules`, `hour_rule_times`, `hour_rule_targets` | See "Is a device online?". Targets are kids, groups or everyone. |
| Notify | `notify_places`, `notify_held` | Apprise destinations, and alerts held back during quiet hours. |
| Family | `family_settings`, `users`, `used_invites`, `pending_invites`, `password_resets`, `dismissed_tips` | Singleton family row: reset time, screen time price, early bonus cap, `new_devices_blocked`, GIF settings, `blocker_last_seen`. |

## Notifications

Parent alerts go through Apprise (`services/notify.py`). Events (chore needs OK, kid note, reward request, new device, device resisting, badge, daily summary, box offline, lock change, overdue) are queued on the DB session and sent only after commit. Security events skip quiet hours unless the family opts in; some others are held in `notify_held`. Destination URLs are stored encrypted (`core/crypto.py`). Kid phone alerts use the bundled ntfy container (`services/push.py`, `NTFY_URL`, `NTFY_PUBLIC_URL`). The in-app inbox (`services/inbox.py`) is written with each event.

Rule worth knowing: the "chore day" is computed in the family time zone (`lock/reset.py:current_chore_day`). Runs are generated at the family `reset_time`.

## Security notes

- **Auth.** JWT bearer tokens for parents and kids (`core/auth.py`). The browser keeps the token in `localStorage` only. It is not in a cookie, and the Next.js proxy never forwards cookies. Passwords hashed; login is rate limited (`core/ratelimit.py`). Secrets (`SECRET_KEY`, `JWT_SECRET_KEY`, `INTERNAL_TOKEN`) are generated on first boot into `DATA_DIR/secrets.json` (mode 0600), overridable by env.
- **Kid login by device.** `/kid/whoami` and `/kid/login` match the requester's IP to a device and its owners. A kid can only sign in as an owner of that device, with the PIN if set. Failed tries are rate limited. The client IP comes from `X-Real-IP` only when the request comes from the trusted proxy IPs (`TRUSTED_PROXY_IPS`, the frontend's static address in compose).
- **Internal token.** `/api/v1/internal/*` requires `X-Internal-Token`, compared in constant time. The same token authenticates the app to the blocker.
- **Proxy.** The Next.js proxy (`frontend/pages/api/proxy/[...path].ts`) forwards a small header allowlist (no `cookie`) and caps request bodies at 12 MB.
- **Photos** (`services/photos.py`). Allowed types JPEG, PNG, WebP; max upload 10 MB; pixel cap 40 MP checked from the header before decoding; always re-encoded to JPEG (strips EXIF and GPS), scaled to 1600 px with a 320 px thumbnail; stored under random names and served only through authenticated endpoints.
- **GIFs.** Off by default. Chat only. Animated GIFs get 8 MB, 300 frame and total-pixel caps, are checked per frame and re-saved without metadata. GIPHY is reached only by the backend with a hard-coded host and validated ids, without redirects. The parent's key is write-only through the API. The family rating (G or PG) is re-checked server-side for every GIF id the client sends (`services/giphy.py:rating_ok`). Kids' devices never contact GIPHY.
- **Fail-open.** If the box or the blocker stops, nothing stays blocked. A failed push logs a warning and retries on the next loop.
- **Backups.** Before migrating, the entrypoint copies the SQLite file to `DATA_DIR/backups/pre-upgrade-<time>.db` when the database is not at head (`backend/entrypoint.sh`).

## Testing

| Layer | How to run | Notes |
|---|---|---|
| Backend unit and API | `cd backend && python -m pytest tests -q` | Includes migrations, integrity (every CHECK), flair CSS coverage. |
| Python style | `ruff format --check backend blocker && ruff check backend blocker` | Run from the repo root; config in `ruff.toml`. Same as CI lint. |
| Frontend | `cd frontend && npm test`, `npm run lint`, `npm run type-check` | Jest tests live in `frontend/tests/v2`. |
| Blocker unit | `python -m pytest blocker/tests -q` | Firewall rules, ARP, portal, identity. |
| Lab journeys | `cd blocker && RUN_INTEGRATION=1 python -m pytest tests/lab -v` | Real ARP, nftables and portal in Docker; needs Linux Docker. |
| Browser e2e | `bash scripts/lab.sh up && bash scripts/lab.sh e2e` | Playwright against the lab; screenshots in `frontend/e2e-artifacts`. |

`scripts/lab.sh` also has helper commands (`block`, `unblock`, `check`, `check6`, `portal`, `resist`, `reset`, `resisting`, `test-block`, `token`, `device-id`). Run it without arguments for the usage line. Lab details: [lab/README.md](../lab/README.md).

CI (`.github/workflows/ci-cd.yml`): `lint` (ruff on backend and blocker, eslint, tsc), `test` (backend pytest), `installer` (shellcheck, install smoke test), `lab` (journeys + browser e2e, uploads screenshots), `security-scan` (Trivy), and image build and push on `main`.

`.github/workflows/pages.yml` deploys the website. When `site/`, `docs/guide/`, `docs/remote-access.md` or the build scripts change on `main`, it runs `python scripts/build_site.py` (markdown to HTML through `scripts/site_templates.py`) and publishes `site/`. After editing those docs, rebuild locally and commit the output. `node site/check.mjs` checks every page (usage is in its header).

## Running and installing

- **Home box:** `install.sh` installs Docker if asked, writes `.env`, and runs `docker-compose.prod.yml` (backend, frontend, ntfy, and the blocker through `COMPOSE_PROFILES=blocker`). Running it again updates the app and keeps `.env` and data. Smoke test: `scripts/test-install.sh`.
- **Dev:** `docker-compose.yml` mounts the source and reloads. `scripts/start.sh` creates `.env` from `.env.example` and starts it.
- **Backend alone:** see [backend/README.md](../backend/README.md).

## Repository map

| Path | What is there |
|---|---|
| `backend/app/api/` | FastAPI routers, one file each: `auth`, `password_reset`, `setup`, `users`, `chores`, `chore_library`, `chore_types`, `chore_photos`, `kid`, `kids`, `kid_push`, `kid_rewards`, `family`, `devices`, `device_activity`, `hours`, `screen_time`, `rewards`, `badges`, `flair`, `community`, `chat`, `inbox`, `notify`, `tips`, `internal` |
| `backend/app/core/` | Config, auth, secrets, crypto, rate limit, client IP, logging, metrics |
| `backend/app/services/` | Business logic: `chores`, `economy`, `progression`, `badges`, `chat`, `photos`, `giphy`, `inbox`, `notify`, `push`, `screen_time`, `kid_view` and more |
| `backend/app/lock/` | Rule engine (`rules`, `hours`, `schedule`), overrides, daily reset, lock loop, blocker client |
| `backend/app/models/`, `alembic/` | Tables and migrations |
| `backend/app/flair/catalog.py` | Flair catalog |
| `frontend/pages/` | Next.js routes: `/` (Today), `/devices`, `/kids`, `/settings`, `/more`, `/notifications`, `/chat`, `/kid`, `/login`, `/register`, `/reset`, `/join`, `/setup`. `api/proxy/[...path].ts` forwards to the backend |
| `frontend/src/v2/` | UI on Next.js and Mantine. `parent/` is the parent shell (v3 restyle: rail, tab bar, `parent-*.css` tokens) around `today/`, `manage/`, `chat/` and `setup/`. `kid/` is the kid app, with three looks in `kid/modes/` (Little, Kid, Teen). Also `flair/` (CSS), `components/`, `hooks/` |
| `frontend/tests/v2/` | Jest tests |
| `frontend/e2e/` | Playwright specs |
| `blocker/` | Home box service: `discovery`, `arp`, `firewall`, `portal`, `resist`, `service`, `api`, `identity`, `hits` |
| `install.sh`, `docker-compose*.yml` | Installer, dev stack and home-box stack |
| `scripts/` | `build_site.py` and `site_templates.py` (website), `lab.sh`, `start.sh`, `test-install.sh`, `check-links.py`, screenshot and demo-seed helpers |
| `site/` | The GitHub Pages website. `site/guide/` is generated |
| `lab/`, `scripts/lab.sh` | Isolated Docker lab and its driver |
| `docs/` | Guide, ADRs, this file, specs and plans under `superpowers/` |

## How to add a badge

1. Open `backend/app/services/badges.py` and add a line to `CATALOG`, for example: `_d("my_badge", "My Badge", "🧹", "Short description.", "approved", 5, 10, 25, 50, 100)`. The last numbers are thresholds for copper through mega-diamond (one number means a single-tier badge).
2. The `metric` string must be one the code computes. Reuse an existing one (`approved`, `best_week`, `longest_streak`, `comebacks`, `weekend_run`, `variety`, `early`, `speed`, `clutch`, `on_time_run`, `xp`, `balance`, `redemptions`, `rewards`, `big_rewards`, `screen_redemptions`, `slots_equipped`), or add a new metric where the metrics are calculated in the same file.
3. Add a test in `backend/tests/test_badges.py` and run `python -m pytest tests/test_badges.py -q`.

Parent-made badges need no code: they are rows in `custom_badges`, created in Kids & chores → Badges.

## How to add a flair item

1. Open `backend/app/flair/catalog.py`. Add to `CATALOG` with the `_i(level, slot, ...)` helper, for example `*_i(12, "ring", "Teal")` (id `ring-teal`, unlocks at level 12). Slots: `card`, `ring`, `name`, `emblem`, `title`. For an emblem use `("suffix", "Name|emoji")`.
2. Non-emblem items need CSS for `.flair-<id>`, in the matching file under `frontend/src/v2/flair/`: `cards.css`, `rings.css`, `names.css` or `titles.css`. Emblems are just emoji and need no CSS.
3. Any animation must be inside `@media (prefers-reduced-motion: no-preference)`.
4. Run `cd backend && python -m pytest tests/test_flair.py tests/test_flair_css.py -q`. The CSS test fails if an item has no CSS or an animation is outside the motion guard.
