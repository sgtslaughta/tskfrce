# Task 4 report: kid lock screen

Status: DONE. Files: pages/kid.tsx, src/v2/kid/{KidPage,KidPicker,PinPad,KidChecklist,UnlockedView}.tsx, src/v2/hooks/useKid.ts, tests/v2/kid.test.tsx.
RED: `Cannot find module '@/v2/kid/KidPage'`, 0 tests. GREEN: kid.test 9/9; full gate lint (no errors), tsc clean, 5 suites / 26 tests pass.

Concerns:
- Backend /kid/today returns only the logged-in kid's chores (token = one kid). Other owners' lists on a shared device cannot be fetched without their own login, so only the selected kid's list is shown, with a "Not me" button to switch. No read-only lists for other owners.
- PinPad is a 0-9 keypad with 4 dots (reading "4 digit" as PIN length), auto-submits at 4.
- "{n} chores done today" counts state==='done' (not "1 chore" singular, per brief copy).
- Restoring a stored token after reload does not know the kid's name, so the name heading shows only after a pick/login in this page load.
