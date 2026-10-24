"""Copy the SQLite DB to DATA_DIR/backups/pre-upgrade-<UTC stamp>.db (run before migrating)."""

import shutil
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings


def main() -> None:
    url = settings.DATABASE_URL or ""
    if not url.startswith("sqlite:///"):
        return
    src = Path(url.removeprefix("sqlite:///"))
    if not src.is_file():
        return
    dest_dir = settings.DATA_DIR / "backups"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"pre-upgrade-{datetime.now(UTC):%Y%m%d%H%M%S}.db"
    shutil.copy2(src, dest)
    print(f"Backed up database to {dest}")


if __name__ == "__main__":
    main()
