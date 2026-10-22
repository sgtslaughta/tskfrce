"""Box-side commands. Password reset: docker compose exec backend python -m app.cli reset-password <name>"""

import sys

from app.core.config import settings
from app.core.database import SessionLocal, _import_all_models
from app.models.user import User, UserRole
from app.services.password_reset import create_reset


def reset_password(username: str) -> int:
    _import_all_models()
    with SessionLocal() as db:
        parents = db.query(User).filter(User.role == UserRole.PARENT).order_by(User.id).all()
        user = next((p for p in parents if p.username.lower() == username.lower()), None)
        if user is None:
            names = ", ".join(p.username for p in parents) or "(none yet)"
            print(f"No parent named '{username}'. Parents on this box: {names}")
            return 1
        token = create_reset(db, user, None)
    base = (settings.BOX_URL or "http://<this-box>:3000").rstrip("/")
    print(f"Open this link to set a new password for {user.username} (works once, 30 minutes):")
    print(f"{base}/reset?token={token}")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[0] == "reset-password":
        return reset_password(argv[1])
    print("Usage: python -m app.cli reset-password <parent-username>")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
