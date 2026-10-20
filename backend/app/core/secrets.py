"""First-boot secrets: generated once, stored in DATA_DIR/secrets.json (mode 0600)."""

import json
import os
import secrets
from pathlib import Path

NAMES = ("SECRET_KEY", "JWT_SECRET_KEY", "INTERNAL_TOKEN")


def load_or_create_secrets(data_dir: Path) -> dict[str, str]:
    """Return the three app secrets; env vars override the stored values."""
    path = Path(data_dir) / "secrets.json"
    stored: dict[str, str] = json.loads(path.read_text()) if path.exists() else {}
    missing = [n for n in NAMES if not stored.get(n)]
    if missing:
        for name in missing:
            stored[name] = secrets.token_urlsafe(32)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(stored, f)
        path.chmod(0o600)
    return {n: os.environ.get(n) or stored[n] for n in NAMES}
