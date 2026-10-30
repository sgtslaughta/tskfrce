# Screenshots

Referenced by the guide and README. v3 look, light mode, JPEG (quality ~82), at most 1400 px wide: desktop shots at 1280 px, phone shots taken at 390 px (2x) and saved 600 px wide.

Taken with Playwright from a demo family (kids Bobby and Susan), read-only: every write request was aborted. Kid screens were rendered as a kid session whose reads go through the parent "view as" header.

| File | Screen and state |
|---|---|
| `today.jpg` | Parent **Today**, desktop, Bobby's day with overdue and to-do chores. |
| `today-kid.jpg` | Parent **Today** on a kid with nothing done yet (Susan, 0 of 7). |
| `needs-you.jpg` | Parent **Today**, desktop, **Needs you** tab. The demo had nothing waiting, so four sample requests were injected into the `/today` response. |
| `setup-account.jpg` | Setup wizard step 1 "Make your parent account", with the step list visible. |
| `setup-family.jpg` | Setup wizard step 2 "Your family" (step 1 filled in locally; nothing is sent before step 2's Next). |
| `setup-hours.jpg` | Setup wizard step 6 "When can devices be online?" with the starting schedule (resumed at step 6 by faking `/setup/step`). |
| `setup-devices.jpg` | Setup wizard step 5 "Whose devices are these?", devices assigned to kid chips and Guest. |
| `devices.jpg` | **Devices** page with one device open (owners, right now, lock and test block buttons). |
| `chat.jpg` | **Chat** on a chore thread with a kid note ("Need help"). |
| `kid-today.jpg` | Kid page (phone): internet paused, chore cards with points and due chips. |
| `kid-chore.jpg` | Kid page: one chore opened with chained steps, "I'm done!" held back. |
| `kid-locker.jpg` | Kid **Customize** (Locker): name card preview, slot tabs, locked items with unlock level. |
