# Plan 3 handoff notes

Plan 3 (frontend) complete on feat/v2-frontend. Carry-overs:
- Ruling: T2–T5 dispatched in parallel worktrees at 62346e0 concurrently with T1 review (owner: fan out); T1 fixes, if any, cherry-picked and parallel branches rebased at merge — cost if wrong: rework
- Ruling: tests/health.test.js + global fetch mock deleted (never valid) — cost: none
- Ruling: shared-device kid screen shows selected kid's list + "Not me" switch (backend /kid/today is per-token; spec wanted all owners' lists) — cost: siblings can't see each other's lists; revisit v2.1 (whoami could include per-owner chore summary)
- Task 1: minor (deferred→T6): startSignOut flag stuck if logout() throws — try/catch reset; T2 wizard should switch to markSetupDone at merge (uses setQueryData directly now — same effect)
- Ruling: T6 scope expanded with backend gaps from T5: GET /chores/definitions (list repeating chores per kid), KidPatch clear PIN (pin: "" or clear_pin:true), invite redemption page /register?token= (frontend) — cost: one bigger T6
- Ruling: scan — safeNext regex bypassable via tab/newline stripping; URL-origin check + control-char rejection added to T6 scope — cost: none
- Ruling: dev compose frontend mem_limit 2g too small for `next dev` compiling legacy /hub; NOT changed in repo now — Plan 4 production image runs prebuilt `next start` (low memory); dev users can override — cost: stock dev `up` may restart-loop on /hub
- Final wave: commits 4a06e0f..e95b244 (90 tests, build ok, smoke ok). Note→Plan 4: root pyproject lacks python-multipart (uv run pytest fails); requirements.txt ok
- Proxy merges multiple Set-Cookie headers into one (pre-existing).
