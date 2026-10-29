"""Reversible sealing of secrets (Apprise URLs) keyed off SECRET_KEY."""

import base64
import hashlib
from functools import cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@cache
def _fernet() -> Fernet:
    digest = hashlib.sha256(("apprise:" + (settings.SECRET_KEY or "")).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def seal(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def unseal(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("unreadable") from e
