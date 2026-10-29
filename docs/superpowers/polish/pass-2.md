# Polish pass 2: words, errors, empty and loading states, accessibility

Method: every user-facing string read (frontend `src/v2`, `pages`, and every backend `HTTPException` detail), every lab e2e screenshot reviewed light/dark at 1280 px and 360 px against the approved mockups (charcoal `#1e2026` page with fading grid, pale kid card with 4 px yellow stripe, navy `#18213f` body; theme tokens only), keyboard and screen-reader paths checked in code and jest. Pairs are in `docs/superpowers/polish/pass-2/` (`<screen>-<size>-<scheme>-before|after.jpg`, <= 200 KB).

Status: done = fixed and confirmed in the new screenshots or tests.

## Step 0: owner review of pass 1

| # | Screen | Problem | Fix | Status |
|---|--------|---------|-----|--------|
| 0.1a | Kid home | A heavy "Chat" button on every chore row. | One quiet 44 px icon button per chore with a red unread dot; the accessible name carries the count ("Chat about Dishes, 2 unread"). | done |
| 0.1b | Kid home | "Waiting for Mom or Dad" was a loose line under the row. | It is the row's status chip (same pill as parent Today); "Taken by X" and "Done" use the same chip. | done |
| 0.1c | Kid home | Disabled "Mark done" was a dashed placeholder with no reason. | Disabled buttons keep their cut shape with a muted fill and readable label everywhere; Mark done says why beside it ("Add a photo first", "Tick every step first", or both). | done |
| 0.1d | Kid home | "Rewards · 0 points" was an empty card. | Friendly empty state with the next step ("Nothing to spend points on yet. Keep finishing chores, then ask a parent to add rewards you can save up for."). | done |
| 0.1e | Kid home | "Family" heading floated outside its card. | Heading, leaderboard and sibling rows share one card. The chores card heading no longer repeats the kid's name ("Your chores"). | done |
| 0.2a | Phone | The floating chat button covered the last item. | `.f-main` reserves 88 px (96 px on phones) of bottom space on every page; there is no bottom tab bar. | done |
| 0.2b | Phone | Device pills showed "task4ce-lab-kid1-1.home.lan". | Friendly short name ("Kid1", "Pixel 7"), 14 characters then an ellipsis, full name in `title` and `aria-label`. The Devices list uses it too. | done |
| 0.3 | Top bar | "Log out" was a big button. | Account menu (initial + name, initial only on phones) with Help (the site, `?from=app`), Settings and Log out. The phone drawer keeps Help and Log out. Theme toggle stays. | done |
| 0.4 | Today | "Chat with Pat" said "No messages yet." beside unread badges. | Shows the newest message across Pat's private thread and Pat's chore threads, with sender, time and the chore it was in, plus "N new". Empty: "Nothing yet. Say hi to Pat." with a "Say hi to Pat" button. The thread list in the chat dock gets the same one-line preview. Backend: thread summaries now carry `last_author` and `last_text` (2 queries, no N+1). | done |

## Copy and names

| # | Where | Problem | Fix | Status |
|---|-------|---------|-----|--------|
| 1 | Chore editor, chores list, e2e | "subtask" (parent) vs "step" (kid). | "Step" everywhere. | done |
| 2 | Setup wizard | "the box" for the home box; "clear the box" meant a text field. | "home box"; "clear the field". | done |
| 3 | Backend | Leftovers from the old app: "Username already registered", "Email already registered", "Invalid refresh token", "Invalid token payload", "User not found", "Inactive user", "Not enough permissions", "Already at mega-diamond", and two 500s that printed the raw exception. | Plain sentences with a next step; raw exceptions are logged, never shown. | done |
| 4 | Page meta | Description still said "task management system". | One plain sentence about chores and internet time. | done |
| 5 | Kid guide | Guide said "Tap Locker" but the button is "Customize". | Guide fixed. | done |
| 6 | Approve all | One "Approved" toast per item. | One toast ("Approved 3 items"); stops and reports on the first failure. | done |

## Empty, loading and error states

| # | Screen | Problem | Fix | Status |
|---|--------|---------|-----|--------|
| 7 | Today, Devices, Kids, Settings, chat dock, thread | Blank page while loading (layout jump when data arrives). | `LoadingCards` skeletons sized like the real cards (`role=status`). | done |
| 8 | Same pages, and every toast | Network down showed "Failed to fetch". | `errorText()`: our message, or "Can't reach the home box. Check it's plugged in and on Wi-Fi." for network failures. Failed loads render `LoadError` (red card, `role=alert`, "Try again"). | done |
| 9 | Kid page | "No chores today." | Adds "Enjoy the free time." | done |

## Accessibility

| # | Where | Problem | Fix | Status |
|---|-------|---------|-----|--------|
| 10 | Award overlay | Dialog name was a fixed "You got a reward". | Named by its heading and described by the award title. Toasts already use `role=alert`; Escape closes. | done |
| 11 | Disabled Mark done | Reason was not tied to the button. | `aria-describedby` points at the reason. | done |
| 12 | Phone top bar | The new account button made the top bar wider than 360 px; phones then widened the layout and the e2e overflow check (`scrollWidth > innerWidth`) could not see it. | The day name hides on phones (it is the page title anyway). The e2e now compares against the real viewport width, so this kind of overflow fails the run. | done |
| 13 | Menu, chat icon buttons | Targets under 44 px. | All 44 px. Keyboard: account menu is a Mantine menu (arrows, Escape, focus return). | done |

## Left alone

- Kid screen order (header, lock, chores, rewards, family) follows the mockup.
- The red photo square and the Next.js dev badge in screenshots are lab artifacts.
- Pass 3 owns query counts and polling.

Re-run e2e: 37 passed (plus the new "account menu open" screenshot at four sizes).
