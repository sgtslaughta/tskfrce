# t@sk4ce v2: Today, Kids & chores overhaul, chore proof and chat

Date: 2026-10-21. Status: draft, pending owner approval.
Extends: `2026-10-21-v2-teen-redesign-gamification-design.md` (same look, same economy/progression). This is Project 5, in two parts.
Mockups (open in a browser): `2026-10-21-v2-teen-redesign-mockups/` — `kids-chores.html`, `today-tabs.html`, `today-dense.html` (photo lightbox, bottom), `needs-types.html`.

## Why

After seeing Project 1 live, the owner found Kids & chores "not clean and intuitive" and Today too thin ("only see an empty check box"). Parents go to Kids & chores mostly to add chores and check each kid's progress, and need to edit kids and chores. Families need chores shared between kids, chores broken into steps, photo proof (the legacy app had it; v2 shows a "Needs a photo" checkbox that does nothing), a way to send work back, and chat (legacy had it; v2 has none).

## Goals

- Today answers "what needs me, and how is each kid doing" without endless scrolling.
- Kids & chores is organized by section with a fast chore editor.
- Chores support multiple kids (three modes), subtasks, copy, edit, required photo proof, and send-back with a note.
- Chat: a thread per chore, a private parent↔kid thread, and a family group chat.

## Non-goals

- No change to the network blocker. No video. No reactions/emoji pickers, typing indicators or read receipts beyond an unread count (legacy has some; not requested).
- Legacy `/hub` screens are not revived.

## Anti-goals

- Today becomes a long scroll with several kids or busy days.
- A chore needing a photo can be submitted without one; a chore with subtasks can be submitted with steps unticked.
- Send back without a note.
- A kid sees another kid's private thread.

## Constraints

- Project 1 look (tokens, gamer-cut controls, Tabler icons via `@tabler/icons-react`, already installed). Stack and CI as in the main spec. Files < 500 lines.
- Legacy backend pieces exist and are mounted (`app/api/media.py`, `comments.py`, `messaging.py`, `websocket.py`, `presence.py`; models `media`, `comment`, `task_comment`, `conversation`, `direct_message`). **Verify before reuse** — the legacy gamification turned out to be a shell. Reshape or replace freely; legacy frontend compatibility not required.
- Photos are private family data: served only to authenticated family members, never public URLs; strip EXIF location on upload; size/type limits.

## Part 5a: Today, Kids & chores, chore features

Owner decisions:

### Today (parent)
- **"Needs you" headline** at the top, across all kids: horizontal list of items needing a decision. Types with chip + Tabler icon + colored left edge: **Chore** (checklist, green), **Redo** (circular arrow, coral — a sent-back chore resubmitted, shows "2nd try"), **Screen time** (hourglass, periwinkle), **Reward** (gift, yellow). Header filter chips per type with counts, plus "Approve all".
- Chore items show the proof photo thumbnail (tap → full-size viewer with pinch-zoom on phones, Approve / Send back, note box required for Send back). Screen time / reward items show cost and the kid's balance; Approve / Deny.
- **One tab per kid** below: tab label = name + `done/total` today + red dot if that kid has a "Needs you" item. Open tab: the kid card (header with level/title, points, XP bar, done today, streak, online/last active) with **Still to do** (every remaining chore: due time, mode tag e.g. Race, subtask progress `1/3`, points) and **Done** (collapsed by default). Side column: **Devices** (online / last seen, paused), **Chat with <kid>** preview + Open, **Recent** activity (badges, cash-ins).
- Level/title/XP/streak/flair come from Projects 3–4; until they land, those spots are hidden, not faked.

### Kids & chores (parent)
- **Sidebar navigation** with sections: **Chores**, **Kids**, **Rewards** (Project 2's manager moves here), **Badges** (Project 3's custom badges land here); plus a per-kid jump list with today's `done/total`. Collapses to a top menu on phones.
- **Chores section:** per-kid progress strip (done/total bar, "N left · M waiting for you"); chore list filterable by kid and "Shared"; each row: title, assignee avatars, mode tag (Solo/Each/Race/Team), repeat + due time, subtask count, points.
- **Chore editor** in a side panel (full-screen sheet on phones): title, points, due by, repeat, **Assign to** (multi-select kids), **When more than one kid**: Each / Race / Team with a one-line explanation, **Subtasks** (add, reorder, remove), **Needs a photo**, Save/Cancel; header actions **Copy** (opens editor prefilled as a new chore, title "<title> (copy)") and **Delete**.
- **Kids section:** list of kids; selecting one opens the kid editor (name, avatar, PIN, delete) in the same side-panel pattern; "Add a kid".

### Chore behavior
- **Modes** for chores assigned to more than one kid (parent picks per chore):
  - **Each** — every assigned kid gets their own instance and their own points.
  - **Race** — one shared instance; the first kid to have it approved gets the points; it closes for everyone. Other kids see it as taken. (Claude's call: if the first submission is sent back, the race reopens for all.)
  - **Team** — one shared instance; any assigned kid can tick subtasks/submit; on approval the points are split evenly among assigned kids, rounded down, remainder dropped (Claude's call). It counts toward each assigned kid's day (streaks).
  - A chore with one kid is **Solo** (same as Each).
- **Subtasks:** ordered list on the chore; the kid ticks each; submit is disabled until all are ticked; the server rejects submission otherwise.
- **Photo proof:** when "Needs a photo" is on, submit requires at least one photo; server rejects otherwise. Photos attach to the chore's thread (Part 5b) — Claude's call: in 5a store photos on the chore instance directly so 5a ships alone; 5b shows them in the thread.
- **Send back:** parent sends a submitted chore back with a required note; status returns to to-do, subtasks stay ticked (Claude's call, kid unticks what needs redoing), the note shows on the kid's chore; resubmission appears in Needs you as **Redo · 2nd try** (3rd…). For the deadline bonus and streak day, the resubmission time counts (Claude's call).
- **Edit** changes future instances and today's not-yet-submitted instances (Claude's call); submitted/approved history is untouched.

## Part 5b: Chat

Owner decisions:
- **Per-chore thread:** every chore instance has a thread; proof photos and send-back notes appear there; kid and parents can post text and photos.
- **Private parent↔kid thread:** one per kid, visible to that kid and all parents.
- **Family group chat:** everyone in the family.
- Unread counts: badge on the kid's Today card (parent) and on the kid's chat entry (kid). Claude's call: in-app only; live updates via the existing websocket if it holds up on review, otherwise polling every 15 s.
- Kids see the same threads on their own screen (their chores' threads, their private thread, the family chat). A kid never sees another kid's private thread.

## Data model (Claude's calls, settled after builder check)

- **Assignment:** the chore definition keeps its config in `recurrence_pattern` (as today) and gains `assignees: [kid_id…]` and `mode: "each" | "race" | "team"`. **Each/Solo** → one instance per kid with `assigned_to_id` (unchanged path). **Race/Team** → one shared instance with `assigned_to_id = NULL` plus a junction table `chore_participants(task_id, kid_id)` used by every "this kid's chores" query; Race sets `assigned_to_id` to the winner on approval.
- **Subtasks:** definition stores ordered titles in `recurrence_pattern["subtasks"]`; `make_instance` copies them into a `chore_subtasks(id, task_id, position, title, done_by_id, done_at)` table so ticks are per instance. Team mode: any participant ticks; no per-kid subtask state.
- **Attempts:** instance gains `attempt INTEGER DEFAULT 1`, incremented on send-back; Needs you shows "2nd try" from it.
- **Photos:** `chore_photos(id, task_id, attempt, uploaded_by_id, path, thumb_path, created_at)`. Photos persist across send-back (history); with "Needs a photo", submit requires ≥ 1 photo for the **current** attempt. Served through an authenticated endpoint only.
- **Chat:** new `threads(id, kind: "chore" | "private" | "family", task_id NULL, kid_id NULL)` and `thread_messages(id, thread_id, author_id, body, photo_id NULL, created_at)` plus `thread_reads(thread_id, user_id, last_read_at)` for unread counts. Chore threads show that chore's photos and send-back notes as messages. Legacy messaging tables are reused only if review shows they fit this shape cleanly; otherwise left alone.

## Left to the builder

- Anything in the data model above that review proves unworkable (say why in the plan).
- Photo storage location and limits (suggest ≤ 10 MB, jpeg/png/heic/webp, server-side resize for thumbnails).
- Exact responsive breakpoints.

## Open (Claude's calls, flagged for owner)

- Race reopens if the first submission is sent back.
- Team points split evenly, rounded down.
- Sent-back chores keep their ticked subtasks; resubmission time counts for bonus/streak.
- Edits affect future and not-yet-submitted instances only.
- Chat is in-app only (no push/email).
- Delivery order: Project 2 → 5a → 3 → 4 → 5b; Projects 3/4 plans get updated mount points (Kids & chores "Badges" section, Today kid tab).
