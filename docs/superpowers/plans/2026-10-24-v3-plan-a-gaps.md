# v3 Plan A — owner-visible gaps (live app vs mockups), 2026-10-24 15:50

Found by screenshotting the live app (http://127.0.0.1:3766, admin / demo-parent-1) at 1440x900 light+dark and 390x844 against mockups 01, 02, 04. Every item must be closed before polish is considered done. Later-plan data (B–F) stays hidden, but the *layout, components and styling* around it must match.

## Global / shell
- Kids & chores, Settings and More still render the old v2 fridge look (navy cards, `NEW CHORE` yellow sticker button, uppercase labels, Mantine tabs). They must use the parent look: list column + detail like mockup 02 (Kids & chores, Settings, Chores editor sections).
- List column header missing on every list screen: title ("Kids", "Devices", "Chat") + kebab, and the segmented pill switch (active = white/ink pill) — mockup 01/02. Current underline tabs are wrong.
- "Home box hasn't checked in" banner renders as plain unstyled text, repeated twice on More. Use the 05-states banner style, once.
- Chat dock FAB is the kid yellow circle; parent screens use the parent chat affordance per mockup 01/02 (rail Chat + dock styled with parent tokens).
- Rail: Log out item at the bottom is hidden/missing; active item needs the soft pill per mockup. Next dev indicator ("N") overlaps the rail — set `devIndicators: false` in next.config.js.
- Phone: tab bar items need the lime pill on the active tab (mockup 04); header bell + avatar button; content must not be cut off.

## Today (mockup 01 desktop, 04 phone)
- Kid cards: name, "3 of 5 chores · Level 7", status chip (ONLINE lime / LOCKED / NEEDS OK lavender / ALL DONE), progress bar, stats row (Points, Streak, Next reward, Locks at) on the selected card.
- Detail header: "<Kid>'s day" + "View as kid" (eye icon, outline) + "Add chore" (lime, + icon); full-width progress meter with "3 of 5 done" at right.
- Chore rows: chevron, lime checkbox, chore-type icon tile, title + sub line ("Due 7:00 PM · 2 of 4 steps" / "Done 4:12 PM · approved"), status chip (APPROVED lime, NEEDS OK lavender, TO DO outline), points "+20" at right; done rows struck through.
- Remove the "0 of 7 done" grey box and the Status/Today/Earned strip if not in mockup 01.
- Phone (04): avatar strip with Add, "Mia's day" card with chips + meter + stats, list card.

## Devices / Groups (mockup 02 Devices + Groups)
- Devices list cards with device icon tile, name, "3 devices · Mia, Leo, Sam" style sub line, maker logo (Simple Icons), status chip.
- Device / group detail: big lime icon tile + title + header chips (count, open, locked, owners), action buttons (Lock group red outline, Unlock 30 min, Back to schedule), "Devices in this group" card with OPEN/LOCKED chips, "Group" edit card (name, icon picker grid, toggles), "Hours for this group" timeline with pattern legend, bottom stats strip (Online now, Alerts, Overrides, Next lock).

## Kids & chores, Chores editor, Settings, More
- Match mockup 02 sections exactly (list column of sections, detail cards, inputs, toggles, lime primary buttons). More (phone, mockup 04): profile card with BOX HEALTHY chip, Settings list rows with icon tiles + sub text + chevrons, Log out row — not a bullet list of links.

## Chat (mockup 02 Chat)
- Thread list rows and the conversation pane must match mockup (bubbles, reactions, quick replies, composer). No Notes tab unless mocked.
