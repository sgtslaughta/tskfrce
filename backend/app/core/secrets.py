"""First-boot secrets: generated once, stored in DATA_DIR/secrets.json (mode 0600)."""

import fcntl
import json
import os
import secrets
from pathlib import Path

NAMES = ("SECRET_KEY", "JWT_SECRET_KEY", "INTERNAL_TOKEN")


def _read(path: Path) -> dict[str, str]:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return {}
    with os.fdopen(fd) as f:
        os.fchmod(f.fileno(), 0o600)
        return json.load(f)


def load_or_create_secrets(data_dir: Path) -> dict[str, str]:
    """Return the three app secrets; env vars override the stored values.

    Creation is serialized with a file lock and written atomically, so
    concurrent workers on first boot all end up with the same secrets.
    """
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / "secrets.json"
    lock_fd = os.open(data_dir / "secrets.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd) as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        stored = _read(path)  # re-read under the lock
        if any(not stored.get(n) for n in NAMES):
            for n in NAMES:
                stored.setdefault(n, secrets.token_urlsafe(32))
            tmp = data_dir / f"secrets.json.{os.getpid()}.tmp"
            tmp.unlink(missing_ok=True)  # stale file from a crashed run (lock held)
            fd = os.open(tmp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w") as f:
                json.dump(stored, f)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
    return {n: os.environ.get(n) or stored[n] for n in NAMES}
