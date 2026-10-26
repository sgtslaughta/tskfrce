# t@sk4ce v3 redesign — design

Date: 2026-10-24 · Branch base: `feat/v2-teen-redesign` · Status: draft for owner review

## 0. How to read this document

**The mockups are the spec.** Every screen in `2026-10-24-v3-redesign-mockups/` was reviewed and
approved by the owner in a live session. Build to them: layout, order, wording, colours, icons,
chip names, button labels. Where this document and a mockup disagree, **section 11 (Mockup errata)
wins, then this document, then the mockup.** Anything not covered by either is left to the builder,
and the builder should match the nearest approved pattern rather than invent a new one.

Open a mockup in a browser. `12-kid-age-switcher.html` loads other files with `fetch`, so serve the
folder (for example `python3 -m http.server` in it) instead of opening it as a `file://` URL.

| File | What it shows | How to see everything |
|---|---|---|
| `01-parent-today.html` | Parent **Today** (desktop): icon rail, kids sidebar, chore list with expansion, steps + chat side by side, accent picker, chore-type legend | Click kids on the left; click chores to expand; "Toggle dark" |
| `02-parent-screens.html` | Every other parent screen: **Devices** (Overview/Network/Activity), **Groups**, **Kids & chores** (Chores editor, Kids, Rewards, Badges), **Chat**, **Settings** (all sections), **Bell** | Icon rail switches screens; list items and tabs switch panes; bell icon at top of rail opens the bell |
| `03-parent-kid-note-flag.html` | Parent side of a kid note (amber flagged row + quick actions). **Its left (kid) half is superseded by file 08** | — |
| `04-parent-phone.html` | Parent **phone** layout: Today, chore + chat sheet, Device → Activity, More → Settings | Toggle dark |
| `05-states.html` | Empty, loading, error, redirect states, toasts, banners; contrast rules | Toggle dark |
| `06-login.html` | Log in, join (invite), reset, forgot password | Toggle dark |
| `07-setup.html` | First-run setup wizard, 7 steps + finish; add/edit hours in step 6 | Click steps in the left list |
| `08-kid-phone.html` | Kid **phone**: chained steps, step deadlines, deduction card, "Tell Mom or Dad" sheet, parent view-as-kid bar | — |
| `09-kid-little.html` | Kid UI, **Little (5–8)** age mode | — |
| `10-kid-kid.html` | Kid UI, **Kid (9–12)** age mode; click the Homework tile for the one-chore view | Toggle dark |
| `11-kid-teen.html` | Kid UI, **Teen (13+)** age mode; status-chip legend; age-group setting | Toggle dark |
| `12-kid-age-switcher.html` | Switch between the three kid modes, dark/light | Serve over HTTP |

## 1. Intent

v2 shipped one "fridge chart" look for everyone. Parents asked for a calmer, denser tool; kids
range from 5 to 17. v3 splits the look by audience and fills gaps found while designing:

- **Parents** get a clean dashboard look (DM Sans, near-black + one neon accent, flat cards,
  list + detail layouts) on every parent screen.
- **Kids** keep the fridge look, but the layout adapts to an **age group** a parent sets per kid.
- New capability: chore **types** with kid **notes**, **ordered steps**, **step deadlines**,
  **point deductions**, **device activity and bypass alerts**, **hour patterns** with holidays and
  summer, **external notifications** (Apprise) and **kid push** (ntfy on the box), richer
  rewards, badges, chat and bell.

### Goals
1. Parents can see and act on everything waiting for them in one or two taps, on desktop and phone.
2. Kids of every age understand what to do next, what is late, and why the internet is off.
3. Every status reads at a glance: consistent chips, icons with colour, never colour alone.
4. Nothing leaves the house: no cloud service is required for any feature.

### Non-goals
- Seeing which websites or apps a kid uses (the box can't, and it's a privacy line).
- Traffic/data-usage monitoring.
- Acting on t@sk4ce from inside Slack/Discord/Signal (pings link back to the app only).
- Kid-side restyle away from the fridge look.

### Anti-goals (a failure even if it works)
- Parent screens that drift from the mockups (the owner has caught drift before and treats approved
  colours as binding).
- Neon text or thin neon bars on a light background (unreadable; see §2.4).
- A login screen that shows family activity.
- Floating dropdown items with no solid themed card behind them.

## 2. Shared visual system

### 2.1 Two looks, two scopes
- **Parent look** applies to every page wrapped by `FridgeShell` plus login, join, reset, and setup.
  Implement as a new token scope on those roots (e.g. a `p-shell` class); do **not** change the
  `--f-*` fridge tokens.
- **Kid look** (fridge) stays on `/kid` (it also uses `.f-shell`, which is why scoping by `.f-shell`
  alone won't work). The parent **view-as-kid** bar is the only parent-look element on a kid page.

### 2.2 Parent tokens (from the mockups)
Light: bg `#f8f8f8`, card `#ffffff`, soft `#f3f3f3`, ink `#292928`, sub `#5f5f5c`, line `#e4e4e1`,
lav `#e3d4fb` / lav-ink `#4a2f8a`, red `#8f1d13` / red-bg `#fde3e0`, amber-bg `#ffefcc` /
amber-ink `#5c3a00`, grid `rgba(41,41,40,.10)`.
Dark: bg `#1c1c1b`, card `#292928`, soft `#323230`, ink `#f4f4f2`, sub `#a8a8a4`, line `#3d3d3b`,
lav `#3d3354` / `#d8c8fb`, red `#ff9b8f` / `#3e2422`, amber `#3b2f17` / `#ffd38a`,
grid `rgba(255,255,255,.07)`.
Font: **DM Sans** (add to `fonts.ts`), monospace for addresses. Radius: cards 16–20px, chips 6px,
buttons pill. Shadows: none on cards; the selected card gets a 1.5px ink outline. Popovers/menus
use a solid card with a 2px ink border and a 3–4px accent offset shadow ("sticker shadow").
Background grid (24px, fading from the top) sits behind the **right/detail panel only** on parent
screens, and behind the whole page on login/setup panels.

### 2.3 Accent colour
Default **Neon `#c3f832`**. Parents choose one of 10 in Settings → Appearance:
Neon `#c3f832`, Sun `#ffd23f`, Tangerine `#ffa94d`, Bubblegum `#ff9ecd`, Lilac `#c9b6ff`,
Sky `#7cc8ff`, Aqua `#5eead4`, Mint `#86efac`, Peach `#ffc4a3`, Ice `#b8f0ff`.
Each keeps `#292928` text on it at ≥ 7:1. Text on an accent fill is always `#292928`.
If Lilac is chosen, the lavender "Needs OK" chip switches to its outline style so it doesn't merge
with the accent.
*Builder's call (mine):* the accent is a **family** setting stored on the server, so every parent
sees the same look. Light/Dark/Match device stays per browser (existing color-scheme manager).

### 2.4 Contrast rules (from the states review)
- No neon text and no thin neon indicator on a light background. In **light mode**, progress
  bars, the scan pulse and loading dots use **ink on a `#e4e4e1` track**; in dark mode they use the
  accent on `#3d3d3b`. Neon is allowed on light only as a filled tile/chip with dark text on it.
- Toasts use the **inverse surface**: dark `#292928` toast in light mode (action link in accent),
  light `#f4f4f2` toast in dark mode (action link in `#1c1c1b`, underlined). Error toast: solid
  `#8f1d13`, white text. Success icon tile: accent with a 1.5px `#292928` inset outline.
- Banners: darker semantic text (no opacity), thin border in the text colour at 30%.
- Every chip has an icon, so status never depends on colour alone.
- Kid side: never white text on coral (2.8:1); use navy `#1d2b53` on coral, amber, green, sun.

### 2.5 Icons
- **Material Symbols Rounded** everywhere, both looks. Use Google's package
  (`@material-symbols/svg-400` or the variable font), **not** `@mui/icons-material` (it drags in
  MUI + Emotion; too heavy for a Pi). No stock emojis in parent UI.
- Kids' own **avatar emoji stays** (a kid choice). Built-in **badge emojis stay on kid screens**
  (parent screens show a mapped glyph).
- **Device maker logos** from Simple Icons (CC0, `simple-icons` npm) for a curated list of common
  makers (Apple, Samsung, Google, Nintendo/Switch, Sony, LG, Amazon, …), mapped from the stored
  `vendor`. Unknown/NIC makers and private MACs fall back to the device-type glyph. Logos are
  monochrome masks that follow the text colour. Microsoft is not in Simple Icons; fall back.

### 2.6 Status chips (one vocabulary, kid and parent)
| Chip | Icon | Meaning | Kid colour | Little-mode wording |
|---|---|---|---|---|
| Overdue | `alarm` | past its deadline (chore or step) | coral bg, navy text | "Late!" |
| Due in N min | `hourglass_bottom` | due within 60 minutes; shows time left | amber `#ffb020` bg | "Hurry · N min" |
| Due 7:30 | `schedule` | due later today | neutral | "By dinner"-style plain time |
| (time only, dashed) | — | no rush / later step | dashed outline | — |
| New | `fiber_new` | assigned in the last 24 h and not yet opened by the kid | lavender | "New" |
| Sent back | `undo` | parent sent it back | coral outline (light: `#a8321a` text) | — |
| Waiting for OK | `hourglass_top` | kid marked done, parent checking | blue | — |
| Approved | `check` | points paid | green | "Done" |
Parent screens use the same states with the parent palette: Approved (accent), Needs OK
(lavender), To do (grey outline), Note (amber, `flag`), deduction (red, e.g. "−10").

## 3. Parent app (Plan A: restyle) — mockups 01, 02, 04, 05, 06, 07

### 3.1 Frame
- **Desktop:** 64px icon rail (logo, bell with red count, Today, Devices, Kids & chores, Chat with
  unread dot, then Settings and Log out at the bottom) · 320px list column · detail panel with grid.
  Replaces the current top bar.
- **Phone:** bottom tab bar (Today, Devices, Kids, Chat with count, More). The active tab is an
  accent pill. Header has title, bell, account initial. "More" holds profile + box health, the
  Settings list (each opens a page), Help & guide, Log out. Replaces the burger drawer.
- Kids appear as an **avatar strip** on phone Today (badge: lavender count = waiting; accent tick
  = all done).
- Every dropdown, popover, select, tooltip and the bell use the solid card style (§2.2). The
  committed `f-pop` theming (`bcd22af`) is replaced by the parent tokens.

### 3.2 Today (01, 04)
- Kids sidebar with **Today / Needs you · N** tabs. "Needs you" = one **combined list** of everything
  waiting across kids (approvals, notes, reward requests).
- Selected kid card expands: progress bar, points, streak, next reward, locks-at.
- Detail: "<Kid>'s day", **View as kid** + **Add chore**, progress line, chore list, summary strip.
- **Chore rows are collapsed until clicked; one open at a time.** Row: chevron, tick box, type
  icon, title (line-through + "Done 4:12 PM" when done), status chip, points (deduction shows
  `+10` struck → `0` and a red `−10` chip).
- **Open chore** = two columns: left = indented steps (numbered if chained, tick + time when
  done, reply button per step) then photos then an **action panel** (soft grey, centred, pinned to
  the bottom of the column): Approve +N, Send back, Deduct points, Open chat. Right = **chat
  column at full row height** (header naming the chore/step being replied to with close, messages
  bottom-aligned, reply box pinned to the bottom). **When chat is closed the left column takes the
  full width.** On phone the chat opens as a **bottom sheet** over the chore.
- Parents can reply on any chore or any step; replies reference the step or photo.
- Kid notes: row tinted amber with a **Note** chip and the note text; quick actions **Reply,
  Move to tomorrow, Skip today (no penalty)** (03).
- **Deduct points:** −5 / −10 / −20 / Custom + a reason the kid will see. Also available from the
  kid's profile (Kids & chores → kid → Deduct), not tied to a chore.

### 3.3 Devices (02 Devices, 04)
- List: unknown new device pinned on top (amber, "Who's this?"); device-type glyph + **maker logo
  badge**; state chip Open / Locked / Exempt / Guest.
- Header: icon tile, name, **chip row** under the name — maker (logo), Online now (accent) /
  "Last seen 2h ago" (grey) when offline, IP (mono), owner. Buttons Lock now, Unlock 30 min.
- Tabs **Overview · Network · Activity** (Activity shows a red count of unreviewed alerts):
  - **Overview:** Details card (name, owners, groups, Guest switch), Right now card (state, why,
    locks at, override), **Online this week** timeline (online / locked / offline per day).
  - **Network:** IPv4, all IPv6, MAC (partly masked), **Private MAC** flag, hostname, maker; first
    seen, last seen, blocker hold, resisting, address changes (7 days); amber tip when private MAC
    is on explaining how to turn off "Private Wi-Fi Address".
  - **Activity:** 7-day counts (Bypass in red, Tries while locked, Outside allowed hours, Wrong
    PINs); **Attempts & alerts** feed with filters (All, Bypass, While locked, Sign-in) and per-alert
    actions; **Time online per day** bars; **Lock history** (schedule, chores, manual with who and
    expiry).
- **Groups** tab: list with device-icon stacks; detail with chip row, Lock group / Unlock 30 min /
  Back to schedule, devices in group (remove/add), group name + **group icon** picker, "Lock with
  the kids' chores" switch, the group's hours on the pattern timeline, summary strip.

### 3.4 Kids & chores (02)
Tabs **Chores · Kids · Rewards · Badges**.
- **Chores:** list grouped by type with assignee avatars; editor = header chips, Basics (name,
  **type picker** with **+ New type**, points, due by, needs photo), **Steps** (drag to reorder,
  per-step **due-time chip**, a tappable **link between steps** toggling "Must be done after the step
  above" / "Any order"; chained steps get number badges, free steps a dashed "–"; amber warning when
  a step is due after the chore), Who & when (kid picker, Each does it / First one wins / Team
  effort, weekday buttons), notes preview for the type, Save. Selected type chip = accent fill with
  dark text and icon.
- **New chore type** side panel: name, icon search + grid, notes list (add/remove/reorder), the
  three universal notes listed as automatic, Create type.
- **Kids:** list with initial avatars and status chips; detail with View as kid / Bonus / Deduct /
  Edit, Profile, Devices, Chores assigned, Points history. Add **Age group** to the kid editor
  (Little 5–8 / Kid 9–12 / Teen 13+), shown in 11.
- **Rewards:** list items **Requests · Catalogue · Screen time · History**, each its own page:
  - Requests: Approve all; card per request with cost, balance before → after (red with "Not
    enough points" and Approve disabled when short), Approve / Decline / note; "See history".
  - Catalogue: card grid with glyph, price, **who can afford it now** (four kid circles),
    Hidden state, New reward card; editor with glyph picker, "Kids can see it", **Needs approval**.
  - Screen time: on/off, price per 15 min, **max per day**, **approve automatically**, only during
    allowed hours, what points buy, bought today per kid, **per-kid limits**.
  - History: 30-day totals, filters by kid and type, Approved / Declined / Auto chips, Export CSV.
- **Badges:** All badges (tier legend Copper → Silver → Gold → Platinum → Mega-diamond, a card per
  badge with **five tier pips per kid**), Custom badges (editor + **Award it** with "Gold →
  Platinum" preview and an optional note), Recent awards.

### 3.5 Chat (02 Chat)
List with search and tabs **All · Chores · Notes · Family**. Thread header with type icon, chips,
Approve / Send back / Deduct. Messages: day separators, system lines, kid **note chip** on the
message, "↳ step" / "Photo 1" references, inline photos and GIFs, **reactions**, **typing
indicator**. **Quick replies** row (first = "Approve + 'Great job!'" in one tap; "Edit replies"
makes the list editable per family). Reply bar: photo, GIF, **@mention**, send. Right side panel
(hidden below ~1250px): steps with tick times, photos, kid today.

### 3.6 Settings (02 Settings, 04)
Sections: **Family, Hours, Chore types, Notifications, Appearance, GIFs, Parents** (Screen time
moved to Rewards; see errata).
- **Hours:** pattern timeline; one texture per kind, drawn in dark ink over the accent:
  School nights = diagonal stripes, Weekends = solid, Holidays = dots, Summer = vertical lines,
  Per child = crosshatch + kid initial, **Per group = horizontal lines**. Legend + overlap line
  (owner decision 2026-10-26): **Holiday and Summer replace everyday hours. Hours for a child,
  their groups and Everyone all apply together** (they intersect). "Today: School night" in the header. **Add holiday**, **Add window**, edit per row.
  Rule: lock until today's chores are done.
- **Notifications:** places (Apprise URLs) with name, masked URL, Test, on/off switch, event
  chips per place; quiet hours with "security alerts still send"; app address for links.
- **Appearance:** accent swatches, Light / Dark / Match device, light+dark preview.
- **Chore types:** list (built-in vs custom), New type, universal notes.
- **Parents:** owner, other parents with Reset link, pending invites with Cancel, Invite a parent.

### 3.7 Bell (02, rail bell)
Solid popover with pointer; Mark all read; filters **All · Needs you · Alerts**; Today / Earlier;
each item icon-tiled by severity with inline actions (Approve +30 / Send back, Approve / Decline,
View / Ask Mia, Reply, Who's this?); unread dot; footer Notification settings · See all.

### 3.8 Login, join, reset (06)
Split panel: left dark `#292928` with grid, wordmark top-left, headline **"Chores done.
Wi‑Fi on."** (accent highlight, never wraps: non-breaking hyphen + nowrap) and one line "Your
family's chore chart, wired to the home network." **anchored bottom-left** (padding 40/44).
No activity or status on the login screen. Right: Welcome back, error banner, username, password
with show/hide, **Keep me logged in**, Forgot password?, Log in, "or", dashed **I'm a kid** card
(fridge sticker icon) → `/kid`, version · address footer. Join (invite, with expiry), reset
(new password twice, success), forgot (ask another parent; only-parent CLI command
`docker compose exec backend python -m app.cli reset-password <you>`). Password strength bar on join.

### 3.9 Setup wizard (07)
Dark left panel: clickable 7-step list with done/active states, progress + time left. Steps:
You, Family, Kids, Chores (starter cards with **type**), Devices (live scan, assign to one or
**several** kids or Guest, private-MAC chip, "not seeing a device?" tip, Skip, "N of M assigned"),
Hours (School nights + Weekends only, **Add hours** button + edit pencil per row opening an editor:
name, kind, days, one or more time ranges, Cancel/Delete/Save), Remote access (optional,
existing wording). Finish → "You're all set" with summary, Go to Today, Set up notifications.

### 3.10 States (05)
Build every state shown: empty (no kids, no chores today, no devices + scan, all caught up, no
chats, clean activity, search no results, empty bell), loading (skeleton, button spinners,
"Updating… last updated", box starting up), errors (can't reach box with auto-retry, banners:
blocker offline / you're offline / update failed, toasts with **Undo** / Retry, form errors,
something went wrong, 404, link expired), redirects (signing out, session expired → back to the
page, setup not finished → resume step, kid on parent page → checklist, opening a ping link).
**Undo** holds approve/lock-type actions client-side for ~5 s before sending.

## 4. Kid app (Plan C) — mockups 08–12

### 4.1 Age groups
Parent sets per kid: **Little (5–8)**, **Kid (9–12)** (default), **Teen (13+)**. All three use the
fridge palette (light + dark variants in the mockups) and the same status chips (§2.6).
- **Little (09):** top: avatar, "Hi Leo!", coral **"No games yet"** pill (instead of "Internet is
  paused"), 4 big stars for chores done. Centre **"Do this now"**: one chore, huge picture tile,
  name, chips (Hurry · 20 min, ⭐ 25), giant green **I did it!** and a ✋ Tell Mom or Dad button.
  Right **Next** queue (Late! / By dinner / New / done struck). Bottom nav: **Chores, Prizes, Me**
  (no chat, no alerts in this mode).
- **Kid (10):** left rail of big buttons (avatar, Chores, Rewards, Chat, Alerts, Me) with coral
  count badges; active = sun sticker. Home: "Hi Leo!", one **status banner** (lock circle, "Internet
  is paused", "Finish 3 more chores to turn it on", big progress dots), 2-column **tiles** (big type
  icon, name, at most two chips, thin progress bar, round → button). Tile opens **one chore at a
  time**: ← All chores, big header, 48px step checkboxes (next highlighted, locked greyed with
  "Unlocks after step 2", deadlines in words), 78px buttons **I'm done!** (disabled until steps
  done + hint), Tell Mom/Dad, Chat.
- **Teen (11):** slim icon rail, header, stats strip (Internet paused + reason, done x/y, points,
  streak), filters (All / To do / Waiting / Done), list rows with chips (overdue sort first), right
  detail panel (chips, numbered steps with time chips, latest message, Mark done, Tell Mom/Dad, Chat).
- **Phone (08):** same rules on a phone; the Kid/Teen rail becomes a bottom bar with the same items.

### 4.2 Kid features (all modes)
- **Chained steps:** a step chained to the one above is greyed with a lock until it's done; the
  server rejects ticking it early.
- **Step deadlines** show as chips; a missed step deadline shows **late only** (no auto deduction).
- **Tell Mom or Dad** sheet: big buttons for the chore type's notes + the 3 universal notes
  (dashed), optional text, Send; afterwards "Note sent: …" on the chore.
- **Deduction card** on the chore: "Dad took 10 points" + reason + Reply.
- **View-as-kid** (built, commit `ef8c7fd`): parent sees the kid's **age mode**; dark parent bar
  "Viewing as Leo · preview" + Back to parent; writes show "Preview only. Log in as Leo to do this."
- Icons: Material Symbols replace current emoji/Tabler UI icons; avatar emoji and built-in badge
  emojis stay.

### 4.3 Kid alerts and push
Events: deadline coming (30 min before a chore or step), missed deadline, new chore, parent reply,
approved / sent back, points taken, reward decided, badge / level, **lock warning** (10 min before
a lock, with chores left). They appear in the kid **Alerts** page (Kid/Teen) and, when set up, as
push via **ntfy hosted on the box** (§6.2). Little mode shows no alerts page; push still allowed.
Kids get **only these kid events**. Parent-side events (bypass, resisting, new device, wrong PINs,
box health, reward requests from siblings) never appear in a kid's Alerts or push — *my call*.

## 5. Chore model changes (Plan B)

| Change | Data | Behaviour |
|---|---|---|
| Chore types | `chore_types` (name, glyph, builtin, position); `chore_type_notes` (type, label, glyph, position); `chores.type_id` (default Other) | Seed 8 built-ins with notes below; built-ins renamable not deletable; custom types CRUD |
| Universal notes | in code | Need help · Ran out of time · Can't do it today, on every type |
| Kid notes | chore-thread message with `note_label` (+ type note id) | Flags the run for parents (amber), notifies parents |
| Note actions | — | Move to tomorrow (reschedule run to next day), Skip today (run `skipped`, no penalty, no streak break) |
| Ordered steps | `chore_steps.after_previous` bool | Server enforces order on tick |
| Step deadlines | `chore_steps.due_time` HH:MM nullable | May be after the chore's due; chore stays open until the latest step deadline (warn, don't block) |
| Step/photo replies | `thread_messages.step_id` nullable (photo_id exists) | Reply on a step or photo |
| Deductions | `points` row, negative amount, `reason='deduction'`, optional `run_id`, description = reason | Parent-only; kid sees it with the reason; −5/−10/−20/custom |
| Status | computed | Chip rules in §2.6 (due-soon window 60 min) |

Seeded types and notes: **Cleaning** (Out of supplies, Did part of it, Too messy for one go) ·
**Schoolwork** (Don't understand it, Left it at school, Need the computer) · **Pets** (Out of pet
food, Pet seems sick, Someone already did it) · **Kitchen** (Out of supplies, Dishwasher still
full, Something broke) · **Outdoor** (Bad weather, Too dark, Tool is broken) · **Practice** (Gear is
broken, Lesson cancelled) · **Personal** (Don't feel well) · **Other** (Did part of it).
Glyphs: cleaning_services, school, pets, restaurant, yard, music_note, self_care, task_alt.

## 6. Notifications (Plan F, and kid push in Plan C)

### 6.1 Parent: Apprise (built in)
- Hook at `services/inbox.notify()` (single choke point). After the DB commit, send in the
  background; failures logged, never block the request. "Test" reports errors to the parent.
- Places: name, Apprise URL (stored encrypted, shown masked, parents only), enabled, event set.
- Events: chore needs OK, kid note, reward request, new device, device resisting / bypass, badge /
  level up, daily summary, box offline; plus locked/unlocked, overdue.
- Quiet hours; held approvals sent as one batch after; **security alerts (bypass, resisting, box
  offline) ignore quiet hours.**
- Each ping: title, body, link to the matching page using the **App address** setting.
- Not now: plain webhooks, acting from chat apps.

### 6.2 Kids: ntfy on the box
- Run an ntfy server as a box service (compose). Each kid gets a secret topic; Settings →
  Notifications shows a **kid phone QR** per kid. The kid installs the ntfy app and scans it.
- The blocker must allow a kid device to reach the box's ntfy port while locked, so lock warnings
  arrive.
- Apprise may target the same ntfy server for parents.

## 7. Devices and blocker (Plan D)

| Feature | Source | Status |
|---|---|---|
| Private MAC flag | MAC locally-administered bit | new, computed |
| Address changes (7 d) | discovery | new log |
| Online timeline / time per day | presence sample each discovery cycle | new table |
| Bypass ("got around the lock") | existing resist detector | log to event table |
| New address right after locking | new device with same hostname within minutes of a lock | new; actions "Same device, merge" / "Different device" |
| Tries while locked / outside allowed hours | portal + DNS hits on the box (already counted) | keep per device per window |
| Left Wi-Fi while locked | discovery drop right after lock | new; says mobile data can't be seen |
| Wrong PIN / sign in as a sibling | kid login rate limiter | log per device |
| Lock history | overrides (exists) + schedule/chore transitions | add transitions |
| Alert actions | Ask <kid> (opens chat), Lock all <kid>'s devices, Mark OK | new |
| Group icon | `device_groups.icon` | new |
| Hours kinds | add window **category** (school_night, weekend, holiday, summer; per-kid/per-group via existing FKs) + optional `start_date`/`end_date` | holidays/summer are date ranges; precedence per §3.6 |

Bypass alerts notify parents (Apprise) even in quiet hours.

## 8. Rewards, screen time, badges, chat (Plan E)

- Rewards: `icon` becomes a Material glyph name (map existing emojis to the closest glyph, else
  `redeem`); `needs_approval` (default true). With approval off, points come off on request and
  the parent is notified. Approve all.
- Screen time: lives under **Rewards** (removed from Settings). Family `max_minutes_per_day`,
  `auto_approve`, `only_in_allowed_hours`; per-kid limits (max minutes, minimum points before
  allowed). Bought-today view. History with CSV export.
- Badges: award **note**; parent screens map built-in emojis to glyphs via a hard-coded
  key → glyph table in the frontend (one entry per catalog key; unknown keys fall back to
  `military_tech`) — *my call*. Custom badge editor uses a glyph picker. **Kid screens show a custom badge's glyph** (fridge
  style); built-in badges keep their emojis on kid screens (owner decision). Existing custom-badge
  emojis migrate to `military_tech` unless a parent picks a glyph.
- Every new icon field (group icon, custom type glyph, reward icon, custom badge glyph) stores a
  **Material Symbols name** and uses one shared glyph picker (search + grid) — *my call, matches 02*.
- Chat: reactions, typing indicator, @mentions, search, quick replies (family-editable),
  "Approve + 'Great job!'" combined action, step references.

## 9. Other app changes
- Kid `age_group` (little | kid | teen; default kid).
- Family `accent` (one of 10 keys; default neon).
- "Keep me logged in" → longer refresh token when checked.
- Toast **Undo** (client-side delay).
- Kid on a parent URL → redirect to checklist (exists in part; match 05).

## 10. Plans and order
| # | Plan | Covers |
|---|---|---|
| A | Parent restyle | §2, §3 (frame, all parent screens' look, phone, states, login, setup) using existing data |
| B | Chore model | §5 + the parent/kid UI for types, notes, steps, deadlines, deductions, chips |
| C | Kid age modes + kid alerts + ntfy | §4, §6.2 |
| D | Devices & hours | §7, hours patterns/holidays/summer UI |
| E | Rewards, screen time, badges, chat | §8 |
| F | Apprise + bell | §6.1, §3.7 |
A first, then B; C–F in any order. Screens in A that show data from later plans render that part
only once the data exists (hide, don't fake).

## 11. Mockup errata (these override the mockups)
1. **Screen time** appears under Settings in 02; it **moves to Rewards → Screen time** only.
2. Settings → Family **Danger zone (vacation mode, export)** and Hours rule **"Exempt school
   devices during homework"**: **not in v3**; omit.
3. Groups **"Block new devices that look similar"**: dropped; omit.
4. Parents pane invite **"expires in 2 days"**: invites last **24 hours**, reset links **30 minutes**.
5. **03** left half (kid side, old fridge layout with note chips) is superseded by **08**.
6. Device Network/Activity: the **"Data used today"** item is dropped (already absent in 02).
7. Mockups use sample names/data and CDN fonts/icons; ship fonts via `next/font` and icons via
   npm packages, not CDNs.
8. Per-group hour windows use **horizontal lines** (02 Groups/Hours); the precedence line in the
   Hours mockup omits per-group — treat per group as equal to per child; if both apply, per child wins.

## 12. Defaults taken (owner may override)
Bypass pings ignore quiet hours · missed step deadline = late only · approval-off rewards deduct
immediately + notify · kid badges keep emojis · "Needs you" is one combined list · keep Move to
tomorrow / Skip today · webhooks later · kid push = ntfy on the box · three age groups.

## 13. Left to the builder
Component structure, API shapes, migration details, how presence sampling is stored and pruned,
exact animation timings, Simple Icons maker list beyond the ones named, how quick replies are
stored, CSV columns.
