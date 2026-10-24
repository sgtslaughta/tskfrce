# Polish pass 1: look and layout

Reviewed: every lab e2e screenshot (desktop 1280 px and phone 360 px, light and dark) for Today, Devices, Kids & chores (4 sections), Chat, Settings, Login, Register, the bell, the chat dock, the setup wizard, the kid PIN screen, the kid home and the Locker. Dark mode was checked against the approved mockups (charcoal page, navy cards, pale kid card with yellow stripe). Method: screenshot first, then fix, then re-run the e2e.

Not reachable in the lab e2e, reviewed in code only: award and level-up celebration overlays (`kid/award.css`), which use theme tokens and need no change.

Status: done = fixed and confirmed in the new screenshots.

| # | Screen | Problem | Fix | Status |
|---|--------|---------|-----|--------|
| 1 | Today | One full-width "New device joined" card per device. With a few devices the page is a wall of identical yellow cards and the kids are pushed below the fold. | One card: "3 new devices joined: a, b and 1 more. Assign them". A single device keeps its own copy. | done |
| 2 | Today (phone) | "Needs you" items scrolled sideways inside the card, so Approve was cut at the edge and Send back was out of sight. | Items stack full width on phones; actions wrap under the text. Desktop keeps the sideways row. Layout moved from inline styles to `.n-list`/`.n-item`. | done |
| 3 | Settings, Devices, Kids | Section heading had a large dead gap above it (default h2 margin inside a grid with gap). | `.m-main h2`, `.m-card h2` margin 0, one size. | done |
| 4 | Settings | Disabled "Save settings" was a faded blob, nearly invisible on navy. | Disabled buttons are outlined with a dashed edge and readable text, no cut corner. Also applies to Mark done and Equip. | done |
| 5 | Settings (phone) | Section switcher (5 items) was cut off with no hint it scrolls; the segments were 28 px tall. | 44 px high segments; when more than 4 sections it scrolls with a fade on the right edge. | done |
| 6 | Login, Register, Reset, Kid (signed out) | Card stuck to the top edge with no brand; the empty kid screen looked broken. | `AuthBrand` wordmark above the card and a gentle top offset (padding, so the page background does not shift). | done |
| 7 | Setup wizard | Seven tiny number squares jammed at the top edge, 28 px tall, no brand, no sense of progress. | Brand, one progress bar per step (filled up to now) and a "Step 2 of 7" caption. Each step keeps its accessible label. | done |
| 8 | Kids & chores | Chore rows said "0 subtasks" for every chore. Noise. | Show nothing for zero; "No steps" only when there is no photo either. | done |
| 9 | Today | "Open" under "Chat with Pat" looked like loose text. | "Open chat" as a regular button. | done |
| 10 | Top bar | Bell was 40 px with a 10 px radius (the controls use 4 px); the menu button was 30 px. | Bell 44 px, 4 px radius; menu button 44 px. | done |
| 11 | Locker | Locked flair at 50% opacity was unreadable (about 1.8:1). | 70% opacity; the Lv label stays. | done |
| 12 | Devices | Device pills showed the full network name ("pixel-7.home.lan") in capitals, long and noisy. | Pill shows the first part; the full name stays in the accessible label and the Devices list. | done |

## Checked and left alone

- Dark theme matches the approved mockups: charcoal page `#1e2026` with the fading grid, pale kid card with a 4 px yellow stripe and navy body. No hard-coded surface colors were added; all new rules use `var(--f-*)`.
- Focus rings (yellow, 3 px) show on every control in the screenshots and in jest.
- The sideways scroll check in the e2e (`scrollWidth > innerWidth`) passes on every screen at 360 px.
- Motion: only the existing focus pulse; nothing new. Reduced-motion is respected.
- The chore photo placeholder is a red square: that is the lab's test JPEG, not a bug.
- The Next.js dev badge in the corner shows only because the lab runs the dev server.

## Before and after

Pairs are in `docs/superpowers/polish/pass-1/` (`<screen>-before.jpg`, `<screen>-after.jpg`, compressed). "Before" screenshots are from the unchanged build; the kid screens, the wizard and the chat dock were added to the e2e in this pass, so they only have an "after" (their problems were found from the first run and fixed before the final run).

The `kid-signed-out` pair shows different states: the before screenshot is the "no kid on this device" card, the after is the PIN screen (the e2e now assigns its device to the seeded kid). Re-run e2e result: 37 passed (every screen at four sizes, journeys). The e2e also now waits out the login rate limit instead of failing when many screens log in within a minute.
