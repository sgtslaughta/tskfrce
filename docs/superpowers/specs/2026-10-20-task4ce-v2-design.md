# t@sk4ce v2 — Design

Date: 2026-10-20 · Status: approved in brainstorming, pending plan

## 1. Intent

Kids ignore chores and play Xbox/iPad all day. Parents need an easy lever: **devices have no internet until today's chores are done and approved.**

t@sk4ce is a free, open-source, self-hosted family app. Parents assign chores; kids mark them done; parents approve; devices come back online. Chat and gamification (points, achievements, leaderboards, rewards) keep it motivating.

The old project (branch `frontend_refactor`, ~52k lines) built a large chores/chat app but **never built device control**, the reason it exists. v2 puts the lock first.

**Audience:** non-technical parents. Every step (install, onboarding, docs, daily use) is written for an absolute beginner. If a step needs the word "Docker" or a router login, it has failed (Docker is fine for the NAS path, see §7).

### Goals
- Lock/unlock any home device's internet, on any home router, with no router configuration.
- Dead-simple install: flash a Raspberry Pi image, plug in, open `http://task4ce.local`, follow the wizard.
- Works from anywhere on day one (parent approves from work) via a guided Tailscale setup.
- Daily cycle runs itself: chores reset each morning, devices relock automatically.
- Keep and modernize existing features: chat, gamification, calendar, notifications.

### Non-goals (v2.0)
- Blocking off home Wi-Fi (cellular, other networks). Home Wi-Fi only.
- Native iOS/Android lock apps (v3).
- Homework-site allowlist while locked (v3).
- Hosted/SaaS offering.

### Anti-goals (failure even if it technically works)
- Setup requires router settings, port forwarding, a domain, or a terminal for the main path.
- A kid can trivially escape the lock (forget network, new MAC).
- Lock feature ships half-done again while side features grow.
- Default credentials or dev secrets in a shipped build or README.

## 2. Naming
- Display name everywhere humans see it: **t@sk4ce**.
- Technical slug: **`task4ce`**: hostname `task4ce.local`, image `ghcr.io/sgtslaughta/task4ce`, Pi image `task4ce-pi.img.xz`.

## 3. Starting point (git)
1. Merge `origin/frontend_refactor` into `main` as-is; tag **`v1.0.0`** ("the old app").
2. All new work on feature branches toward **`v2.0.0`**. Semantic versioning + conventional commits.
3. Deleting old branches (`phase_1`, `phase_2`, `task_wkflw_msg_ft`, `taskpage_refactor`, `frontend_refactor`) only with the owner's explicit OK at that time.

## 4. Enforcement: how devices get locked

### 4.1 Mechanism (decided)
A **network intercept** service on the always-on box sits between chosen devices and the router (the approach Circle and Firewalla's "simple mode" use: ARP spoofing for IPv4, plus NDP/router-advertisement handling for IPv6). Blocked devices lose outside internet. Unblocked devices are left alone, or forwarded transparently.

- **Must block IPv4 and IPv6** from v2.0.
- **LAN access to the box stays open while blocked**, so a locked iPad can still open the kid screen and mark chores done.
- **Fails open:** if the box is off or unplugged, devices go back online. Accepted. Mitigation: parent alert "Home box went offline" when the box is unreachable for >2 min (needs an external heartbeat; see §10). Docs tell parents to place the box out of kids' reach.
- **"Test block" button:** blocks one device, verifies it's actually offline, and tells the parent plainly if their router resists (some mesh systems, e.g. certain Eero/Google Wifi models). The docs keep a known-router compatibility list.
- **"Internet is paused" captive portal** (owner-approved 2026-10-20): for blocked devices, the box answers DNS queries itself (any name → the box's LAN IP) and serves plain-HTTP requests on port 80 with a redirect to the kid screen (`http://task4ce.local/kid`). The OS captive-portal checks (Apple `captive.apple.com`, Android `connectivitycheck.gstatic.com`, Windows `msftconnecttest.com`, Xbox) then pop up the kid screen automatically. HTTPS can't be redirected without certificate errors, so it is simply dropped. Encrypted DNS (DoH/DoT) skips the redirect, but the device stays blocked either way. Comfort only, not enforcement.
- Runs as a **separate container with host networking** and the needed capabilities (NET_RAW/NET_ADMIN). The app talks to it over a small local API.

### 4.1a Bypass matrix (goes into beginner docs too)

The block drops packets, not DNS answers, so DNS changes and VPNs don't bypass it.

| Bypass | Handled by |
|---|---|
| Change DNS / VPN | Doesn't work: all internet-bound traffic dropped |
| Forget network / rotating private MAC | New MAC = new device = quarantined (blocked) |
| Static IP | Blocker keys on MAC and re-learns IPs from ARP/NDP |
| IPv6 | Blocked from v2.0 |
| Cellular / hotspot / other Wi-Fi | Out of scope (home Wi-Fi only); v3 native apps |
| Unplug box | Fails open; parent alert; docs: place box out of reach |
| Router anti-spoofing | Test block says 'router'; see docs/routers.md |
| Laptop admin pins static ARP for router | Not prevented; **detected**: device flagged and parents notified (Plan 5) |

### 4.2 Device discovery & identity
- The box discovers devices on the LAN and shows friendly names (MAC vendor lookup plus DHCP/mDNS hostname, e.g. "Microsoft Xbox", "Emma's iPad").
- **New/unknown devices start blocked.** Parent gets a ping: "New device joined: Apple iPad. Assign it?" Options: assign to kid(s), or mark **Guest / always allowed**. Family setting can flip the default to "allowed."
- This defeats the "forget network / rotating private address" escape: a rotated MAC is simply a new device, so it lands in quarantine (blocked). No MAC-rotation tracking logic needed. Docs explain turning off iPad's rotating private address for the home network so parents aren't re-assigning it.

### 4.3 Device model
- A device has **one or more owner kids**.
- **Shared device** (owners >1) unlocks only when **all** owners satisfy the rule (§5).
- **Device groups:** named sets ("Living room", "All consoles"). Groups can be locked/unlocked and given windows.
- Parent can lock/unlock: **a single device, a group, or everything a kid owns**, optionally with a timer ("unlock 1 hr").
- When a manual override timer expires, automatic rules resume.

## 5. The rule (decided)

A device is **online** when:

```
(no allowed hours set OR inside allowed hours)
AND (
  no chores scheduled today for its owner(s)
  OR all owners' chores today are approved
  OR inside a free-time window
  OR an active manual unlock / bonus time applies
)
```

A **manual lock** beats everything. A **manual unlock** with no timer stays on until the parent removes it, **including across the daily reset**; the UI shows this state loudly (my call). Timed overrides also survive the reset until they expire.

**Group actions** (my call): locking/unlocking a group sets the same override on each member device; there is no separate group-level state. Windows set on a group apply to each member, combined with the owner kid's windows (a device must satisfy both).

**Time zone** (my call): changeable in settings; takes effect at the next reset. Today's chores are untouched.

### Windows
- **Allowed hours** (outer limit, e.g. bedtime). Optional. **None set = online all day** (subject to chores).
- **Free time** (pass): online even if chores aren't done, e.g. Sat 9–11 AM. Optional.
- Set per kid or per device group. Default for a new kid: **no allowed hours, no free time**. Parent adds them in the wizard or later.
- The wizard suggests 7 AM–9 PM as an example; it is not forced.

### Daily cycle
1. At the family's **reset time** (default 6:00 AM, local time zone), today's chore instances are created from repeat rules. Devices whose owners have chores today lock.
2. Kid marks chore done (from any device, including a locked one).
3. Parent approves (app or notification).
4. When all of a kid's chores are approved, their devices unlock (if windows allow).
5. Unfinished chores **vanish at the next reset** (no carry-over) and **break the streak**.

### Bonus time (gamification reward)
- Kids spend points on bonus minutes.
- Default: bonus time only applies **after** chores are approved and **never past allowed hours**.
- Family setting: "Points can unlock early" (off by default) lets bonus time bypass the chore lock (still not allowed hours).
- **When bonus time can be spent** (owner decision 2026-10-20, ships v2.1): a parent setting `bonus_when` with two choices:
  - `during_windows`: bonus minutes count only inside allowed hours. Useful with "Points can unlock early" (skip chores for a while) or with free-time/allowed windows shorter than the whole day.
  - `after_windows`: bonus minutes extend past the end of allowed hours (e.g. 30 min past bedtime), only after chores are approved.
  - Rule-engine change in v2.1: with `after_windows`, an active bonus satisfies the allowed-hours check too.
- Later (not v2.x scope): deeper rewards — points → allowance or other privileges (parent-defined reward catalog).

## 6. People & accounts
- Roles: **Parent** and **Kid** only. Replace old `user/organizer/admin`.
- First parent set up = **owner**. Can invite other parents/guardians via link/QR.
- Kids have **no password**. Recognized by device (the box knows which device asks). On a shared device: avatar picker + optional 4-digit PIN.
- Parent login: password; optional PIN for quick approvals on own phone (builder's call).

## 7. Deployment

### 7.1 Main path: Raspberry Pi image
- Prebuilt `task4ce-pi.img.xz` (Pi 4/5, 64-bit). Parent flashes it with Raspberry Pi Imager (which can preset Wi-Fi), plugs it in, and opens `http://task4ce.local`.
- Image includes the app, the blocker, and Tailscale (installed, not logged in).
- Wired Ethernet recommended in docs; Wi-Fi supported.

### 7.2 NAS / home server path: Docker
- `docker compose` file with two services: `app` and `blocker` (`network_mode: host`).
- Multi-arch images (amd64 + arm64) on GHCR.
- One-page guide for Synology/Unraid/CasaOS-style setups.

### 7.3 Remote access ("use it from anywhere")
- Default: **Tailscale**. Wizard step: "Sign in to Tailscale on this box" (shows QR/link), then "Install Tailscale on your phone."
- `tailscale serve` provides HTTPS on the tailnet name. This is required for installable PWA + web push.
- Secondary guide: Cloudflare Tunnel, for people with a domain.

### 7.4 First-run wizard (my call on steps; builder may refine)
1. Name your family, set the time zone (auto-detected).
2. Create the owner parent account. **No default credentials exist anywhere.**
3. Add kids (name, avatar, optional PIN).
4. Pick devices from the discovered list → assign to kids, or mark guest. Run "Test block" on one.
5. Add first chores (offer starter templates: make bed, dishes, homework…).
6. Optional: windows (allowed hours, free time).
7. Optional: set up remote access (Tailscale).

### 7.5 CI/CD
- Fix existing `.github/workflows/ci-cd.yml` (it calls a missing `run_tests.py`).
- Lint + type-check + tests on PRs. On release tag: build multi-arch images → GHCR, and build the Pi image (e.g. pi-gen) as a release asset.

### 7.6 Docs (all beginner-level, plain language, screenshots)
In `docs/`: "Set up your Pi", "Set up on a NAS", "Use it from anywhere", "Add a device", "Why is my device still online?" (troubleshooting), router compatibility list. README rewritten to point at these; remove published default admin password.

## 8. Stack & modernization (my call; ponytail principle: fewest moving parts on a Pi)
- **Keep:** FastAPI + SQLAlchemy + Alembic, SQLite, Next.js + React + TypeScript + Mantine, TanStack Query, WebSockets, JWT auth.
- **Drop:** MinIO (store uploads on local disk volume), Redis (in-process WebSocket fan-out; single instance), Celery (unused; use an in-process scheduler, e.g. APScheduler, for the daily reset, windows, and timers).
- **Fix:** the empty initial Alembic migration (regenerate a real baseline); dev secrets in compose (generate a secret on first boot, store in data volume).
- **Containers:** exactly 2. `app` = one image holding frontend + backend (my call: one thing to run/update, simpler Pi image and compose). `blocker` = separate image, host networking. Both built multi-arch in CI.
- **Chore model** (my call): reuse the existing `Task` model as the chore. It already has `is_recurring`, `recurrence_pattern`, and `TaskTemplate`. Add per-day chore instances (or equivalent) for the daily reset + approval state, and owner kid. The UI says "chore" everywhere. Task features chores don't need (dependencies, lists, priorities) stay hidden in the UI; delete code only when it gets in the way. **No v1 data migration**: there are no deployed users; v2 starts from a fresh DB with a real baseline migration.
- **Blocker footprint:** target <100 MB RAM idle on a Pi 4. Language is the builder's call (Python + scapy keeps one language; Go is fine if Python can't meet the footprint or IPv6 needs).
- **File size:** keep files under 500 lines. Split the existing oversized files (`task_service.py` 1625, `Dashboard.tsx` 1275, `notification_service.py` 1081, `comment_service.py` 1056, `NotificationContext.tsx` 1031, etc.) as they are touched.
- Mantine stays as the component layer, themed to the visual direction (§9).

## 9. Frontend & visual direction (decided)

### 9.1 Look: "Fridge chart"
Chunky outlines, sticker colors, hand-made chore-chart feel. Friendly to kids and parents.
- Type: **Fredoka** (display, names, buttons), **Nunito** (body).
- Cards: 3px ink outline, 18px radius, hard offset shadow (4px 4px 0 ink). Sticker labels are slightly rotated.
- **Light and dark mode**: follow the system setting, with a manual toggle.

| Token | Light | Dark |
|---|---|---|
| bg | `#E6EFF1` | `#18213F` |
| card | `#FFFFFF` | `#232F57` |
| ink/text | `#1D2B53` | `#F1F5FF` |
| outline/shadow | `#1D2B53` | `#0C1229` |
| sun (action/pending) | `#FFC93C` | `#FFC93C` |
| red (offline/locked) | `#FF6B4A` | `#FF7A5C` |
| green (online/done) | `#7BD389` | `#6FD08A` |
| sub text | `#4A5A80` | `#B4C2E6` |
| muted chip | `#DCE4F2` | `#34416B` |

Mockups: `.superpowers/brainstorm/*/content/parent-chips.html` and `fridge-modes.html` (local only, gitignored). Builder may copy them into `docs/` for reference.

### 9.2 Parent home ("Today")
- Header: day name. Yellow sticker: "N chores need you" when approvals are pending.
- **One card per kid:** lock/unlock badge, name, Approve button when something is pending.
- **Chip row per kid:** one square per chore (✓ done / ! needs you / blank to do), then one pill per device with icon + name (red offline / green online).
- **Collapse** when many: beyond ~5 chores or ~3 devices, show a summary (e.g. "✓ 4/6 · +3 devices"); tap to expand.
- Tap a device pill → quick lock/unlock (with timer options). The kid's badge → lock/unlock everything they own.
- Shared devices and groups are reachable from a Devices screen (builder designs it in the same style).

### 9.3 Kid screen (shown on a locked device)
- Big red lock: "Internet is paused — Finish your chores to unlock."
- Checklist: chore name, points (+10), state (done / "Waiting for Mom or Dad" / to do), "Mark done" action, optional photo upload.
- On a shared device: each owner's checklist visible (siblings see who's holding it up).
- When unlocked: shows time left in window/bonus, points balance, streak.

### 9.4 Existing features (v2.1)
Chat, points, achievements, leaderboards, rewards (incl. bonus time), calendar, and notifications are **kept**, restyled into the fridge-chart look, and simplified where needed. Kid-facing screens use the kid's vocabulary ("chores", "points").

### 9.5 Copy rules
Plain words, sentence case, no jargon ("device is offline", not "ARP spoof active"). Errors say what happened and how to fix it.

## 10. Notifications
- In-app real-time (existing WebSocket system).
- **Phone push (v2.2):** installable PWA + Web Push over Tailscale HTTPS (iOS 16.4+ home-screen apps, Android). Events: chore needs approval, new device joined, box went offline.
- "Box went offline" can't come from the box itself. Builder decides how to deliver it (e.g. client-side "can't reach box" banner in the PWA, or Tailscale's own device-offline alerts documented). Keep it simple; no hosted service.

## 11. Release phases
1. **v2.0** (core): merge/tag v1, stack slim-down, blocker (IPv4+IPv6), discovery + new-device quarantine, devices/groups/owners, chores with repeat rules + approvals, windows + rule engine + daily reset, parent and kid screens in the new look, setup wizard, Pi image + Docker, Tailscale guide, beginner docs, CI fixed.
2. **v2.1:** chat and gamification restyled and trimmed; points → bonus time reward.
3. **v2.2:** PWA push notifications, box-offline alert, polish.
4. **v3:** native iOS (Screen Time / Family Controls entitlement) and Android lock apps; homework allowlist.

## 12. Constraints
- Runs well on a Raspberry Pi 4 (2 GB) or better.
- No external hosted service required to function (Tailscale optional, for remote use).
- No default credentials; secrets generated at first boot.
- Files under 500 lines where possible; CI green before commits.
- Data lives in one volume (SQLite DB + uploads + secrets) for easy backup.

## 13. Left to the builder
- Blocker implementation language/library (e.g. Python + scapy, or Go) and the exact app↔blocker API.
- IPv6 technique details and router-compatibility detection logic.
- Scheduler library, file layout.
- Exact wizard visuals, Devices/Groups/Windows screen layouts (in the §9 style).
- Details of mapping `Task`/workflow onto chores (direction fixed in §8).

Note: bonus time (points → minutes) ships in **v2.1** with gamification; the rule engine in v2.0 must already support "active bonus time" as an unlock source so v2.1 only adds the spending UI.
- Pi image build tooling.
