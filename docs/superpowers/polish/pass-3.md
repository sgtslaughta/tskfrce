# Polish pass 3: performance, robustness, cleanup

Query counts are SQL statements per request (4 kids x 5 chores each/race/team with steps and photos, 3 devices, chat messages). Test: `backend/tests/test_query_counts.py` (fresh session per request; limit 15, `/today` 17).

| Endpoint | Before | After |
|---|---|---|
| GET /api/v1/today (parent) | 166 | 17 |
| GET /api/v1/kid/today | 51 | 15 |
| GET /api/v1/profiles | 19 | 7 |
| GET /api/v1/leaderboard | 12 | 6 |
| GET /api/v1/kid/celebrations | 5 | 5 |
| GET /api/v1/chat/threads (kid) | 23 | 9 |
| GET /api/v1/chat/threads (parent) | 36 | 10 |
| GET /api/v1/notifications | 3 | 3 |
| GET /api/v1/chores/ (library) | 62 | 5 |

| Area | Problem | Fix | Status |
|---|---|---|---|
| /today | `db.commit()` before building the payload expired every row, so each run, tick and step reloaded (about 120 queries); per-kid progress and per-device lock facts ran queries per kid/device | Build payload, then commit; `with_detail()` eager loads; `progress_many`, `Prefetch` (overrides and windows for all devices), counts from already loaded runs | Fixed. 17 queries; the floor is auth, family, runs+steps+ticks+kids, kids, devices+owners+groups, overrides, windows, xp, streak, flair, redemptions. Spec target of 15 not reached; each remaining query is a distinct table |
| kid/today | Per-run lazy loads, device facts per device, taker lookup per run, 3 family re-queries | `with_detail`, `Prefetch`, batched takers, xp and balance in one query; `get_family` keeps a strong ref on the session (identity map is weak, so repeat calls re-queried) | Fixed (15) |
| profiles / leaderboard | Per-kid xp, streak, flair, badges, custom badge | `xp_many`, `chore_days_many` (one query), `equipped_many`, `badges_for_many` | Fixed |
| chat threads | Per-kid thread lookups, per-chore-thread run load | `_ensure_private` single lookup, batched chore titles | Fixed |
| chore library | Steps, assignments, kids lazy per chore | `selectinload` | Fixed (5) |
| celebrations, notifications | None | n/a | Already at 5 and 3 |
| Polling | Missing `refetchIntervalInBackground: false` on 6 hooks | Added everywhere | Fixed |
| Polling intervals (all in `frontend/src/v2`) | n/a | useKid 10 s; useToday 15 s; useKidRewards 15 s; chat threads 15 s; thread 15 s (KidCard) or caller `ms`; useRewards 30 s (pending redemptions hook deleted: unused); useInbox 30 s; blocker 30 s; setup StepDevices 5 s | None under 5 s |
| Bundle | Unused dependencies | Removed 21 unused packages from `package.json` and lockfile (lock-only): @hookform/resolvers, @mantine/{carousel,charts,form,modals}, @heroicons/react, date-fns, lodash, @types/lodash, @emotion/*, embla-*, motion, ogl, react-hook-form, recharts, zod, zustand, @typescript-eslint/*, prettier. Kept dayjs (peer of @mantine/dates) | Fixed. First Load JS unchanged (tree-shaken already); install size and CI time drop |
| Bundle sizes (First Load JS, shared 198 kB) | n/a | / 223 kB; /chat 211; /devices 233; /kid 219; /kids 241; /login 173; /register 171; /reset 173; /settings 231; /setup 212; /[...slug] 163 | Recorded. Nothing over 250 kB |
| Backend deps | requests, urllib3, python-dateutil, pytz, mypy, mypy-extensions, pathspec, pytest-cov, pytest-asyncio, ruff unused at runtime/tests | Removed from `requirements.txt`. `pyproject.toml` still lists some (left alone to avoid touching uv.lock) | Fixed |
| Dead frontend code | `src/types/user.ts`, `global.d.ts`, `lodash.d.ts` (declared modules for removed deps), 5 unused API helpers, 11 unused cookie helpers, `Role` type, `transpilePackages` | Deleted, type-check and tests green | Fixed |
| Dead backend code (ponytail-audit) | 47 unused settings in `core/config.py` (SMTP, webhooks, OpenAI, backup, cache, pool, feature flags); `get_optional_user`, `CommonQueryParams`, `get_pagination_params`, `get_request_metadata` | Deleted | Fixed (config.py 269 to 195 lines) |
| Legacy auth stack (`tokenManager` 515 lines, `UnifiedAuthContext` 475, `httpInterceptor` 367, `ThemeContext` 266, `bitwarden-theme-fix`) | Still the live login path; a lot of unused surface (refresh events, listeners, brand colors) | Listed, not changed: replacing auth/theme is a behavior change | Deferred |
| Files over 500 lines | `tokenManager.ts` 515 (legacy, above); alembic baseline 1208 and `b8c9d0e1f2a3` 430 (migrations, immutable) | Not split | Deferred; no v2 or app file over 320 lines |
| Orphans | `src/v2/collapse.ts` only imported by its test | Kept (tested helper), flag for pass 2 owner | Open |
| `pyproject.toml` | Duplicates dependency list with extras no one installs | Not touched | Open |
