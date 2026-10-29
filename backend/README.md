# t@sk4ce backend

FastAPI app with SQLAlchemy, Alembic and SQLite. It holds chores, points, rewards, chat, device rules and the lock loop that tells the home-box blocker who to pause. Overview for contributors: [docs/engineering.md](../docs/engineering.md).

## Run

With Docker (from the repo root):

```bash
cp .env.example .env     # set INTERNAL_TOKEN; scripts/start.sh does this for you
docker compose up -d --build
```

The dev stack serves the frontend on http://localhost:3000 and the API on http://localhost:8000 (docs at `/docs`). A home-box install uses `docker-compose.prod.yml` through `install.sh`.

Without Docker:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

`entrypoint.sh` (the container start) backs up the database to `DATA_DIR/backups/` when it is behind, runs `alembic upgrade head`, then starts uvicorn (with `--reload` only when `ENVIRONMENT=development`).

## Settings

Read from the environment or `.env` (`app/core/config.py`).

| Variable | Default | Meaning |
|---|---|---|
| `DATA_DIR` | `./data` | SQLite file, uploads, `secrets.json`, backups |
| `DATABASE_URL` | `sqlite:///{DATA_DIR}/task4ce.db` | Database |
| `SECRET_KEY`, `JWT_SECRET_KEY`, `INTERNAL_TOKEN` | generated on first boot | Saved in `DATA_DIR/secrets.json`. Env wins. The compose files require `INTERNAL_TOKEN` so the blocker shares it |
| `BOX_URL` | none | Public address of the box, used in reset links |
| `TRUSTED_PROXY_IPS` | loopback | Peers allowed to set `X-Real-IP` (the frontend proxy) |
| `CORS_ORIGINS`, `TRUSTED_HOSTS` | localhost | Comma lists read in `app/main.py` |
| `BLOCKER_URL` | `http://127.0.0.1:7777` | Where the backend pushes blocked devices |
| `LOCK_INTERVAL_SECONDS`, `LOCK_LOOP_ENABLED` | `30`, `true` | Lock loop |
| `NTFY_URL`, `NTFY_PUBLIC_URL`, `NTFY_PORT`, `NTFY_CONF_FILE` | none | Kid phone alerts through ntfy |
| `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `REFRESH_TOKEN_REMEMBER_DAYS` | `30`, `7`, `30` | Token lifetimes |
| `MAX_UPLOAD_SIZE` | 10 MB | Photo upload cap |
| `LOG_LEVEL`, `ENVIRONMENT`, `DEBUG` | `INFO`, `development`, `false` | Logging and mode |

## Layout

```
backend/
├── app/
│   ├── main.py        # app, middleware, router wiring, /health, /metrics
│   ├── cli.py         # python -m app.cli reset-password <username>
│   ├── api/           # routers, one file per area
│   ├── core/          # config, auth, secrets, crypto, rate limit, database
│   ├── models/        # SQLAlchemy tables
│   ├── schemas/       # Pydantic request and response models
│   ├── services/      # business logic (chores, economy, chat, notify, photos...)
│   ├── lock/          # online rules, hours, schedule, lock loop, blocker client
│   ├── flair/         # flair catalog
│   └── utils/         # backup_db
├── alembic/           # migrations
├── tests/             # pytest
├── entrypoint.sh
└── Dockerfile
```

## Migrations

```bash
cd backend
alembic revision -m "short name"   # then edit the new file in alembic/versions/
alembic upgrade head
```

Rules and the schema design: [relational schema spec](../docs/superpowers/specs/2026-10-21-v2-relational-schema-design.md).

## Test and lint

```bash
cd backend && python -m pytest tests -q
cd .. && ruff format --check backend blocker && ruff check backend blocker
```

CI runs both (`.github/workflows/ci-cd.yml`).

## Monitoring

`GET /health` for health and `GET /metrics` for Prometheus. Logs: `docker compose logs -f backend`.

## Account recovery

On the box: `docker compose -f docker-compose.prod.yml exec backend python -m app.cli reset-password <parent-username>` prints a one-time link (30 minutes). Another parent can also make one in Settings, Parents.

## License

GPL-3.0, see [LICENSE](../LICENSE).
