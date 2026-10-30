# Plan 1 handoff notes (for Plans 2–4 and v2.1)

Carried forward from the Plan 1 build ledger. Plan 1 is complete on feat/v2-core.

## For later plans
- Task 2: minor (deferred): F811 duplicate defs in comment_service.py, goals.py:222, media.py:137 (later def wins) — clean when touched (7A/5)
- Task 2: minor (deferred): rate limiting not wired (pre-existing); consider for Plan 4/hardening
- Task 2: minor (deferred): pyproject [tool.bandit]/[tool.mypy] stale paths; CI lint installs full reqs
- Task 2: minor (deferred): mention_service.get_mentionable_users references nonexistent User.first_name/last_name — broken legacy; fix or delete in 7A
- Task 2: minor (deferred): pytest floor lowered to >=7.4.0 to match pinned 7.4.3
- Task 3: minor (deferred→T6): config DATABASE_URL default still used the old pre-v2 name
- Task 4+5: minor (deferred): orphan file on failed DB commit in create/delete_media_attachment; dup validate_file_upload noqa F811; LocalStorage.stats unused; traversal URL test may not hit ValueError path
- Task 4+5: minor (deferred→7A): upload_file still current_user_id=1 unauth; get_file no ownership check; Content-Length precheck after spool (cosmetic)
- Task 6: minor (deferred→Plan 4 docs): .env.example/README still use the old pre-v2 name
- Note→7A: auth.py signs with PyJWT, deps.py decodes with python-jose — unify on one lib (PyJWT) and drop python-jose
- Task 6: minor (deferred→Plan 4 docs): old host ./data orphaned by named volume; dev ./backend:/app overlay
- Note→7B: global 404 handler in main.py overwrites HTTPException detail with 'Endpoint not found' — only replace for unmatched routes
- Task 12: minor (deferred): IntegrityError race path untested; thread test sleep-based; shutdown task not awaited
- Task 13: minor (deferred→final fix wave): kid delete leaves recurring chore definitions spawning for nobody (cancel kid's chore defs+open instances); owner_ids [] keeps status assigned (→ unassigned); schemas HH:MM use re.fullmatch; online_all true for kid with no devices; window "neither" message; no way to clear PIN; kid-token 403 only tested on PATCH /family
- Ruling: legacy files >500 lines (messaging.py 643, comment_service.py 877, workflow_service.py 555, comments.py 516) parked to v2.1 chat/gamification restyle — cost if wrong: constraint violated until v2.1
- Task 14: minor (deferred→final wave): LOOPBACK omits ::ffff:127.0.0.1; ratelimit keys use raw client_ip not norm_ip; main.py:95 logs client.host not real IP; check/hit burst can exceed by in-flight count
- Task 7A: minor (deferred→final wave): kid POST /tasks can set parent_task_id/category/is_recurring (low risk)
- Task 7B: minor (deferred): interleave test doesn't assert B blocked (add Event/is_alive)
- Task 15: complete (verification only, no commits; all checks green; frontend minio/redis refs → Plan 3)
- Note→Plan 4: docker-proxy/userland-proxy can hide kid IP from frontend; Plan 4 single app image (frontend+backend in one container, host networking on Pi) resolves it; fails closed meanwhile
- Note→Plan 3: next start /ws rewrite passes client headers (harmless today)
