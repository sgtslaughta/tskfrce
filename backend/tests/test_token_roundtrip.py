from app.api.deps import get_current_user_from_token
from app.core.auth import AuthService
from app.models.user import User
from fastapi.security import HTTPAuthorizationCredentials


def test_token_signed_by_authservice_decodes_in_deps(db):
    user = User(username="u", email="u@example.com", hashed_password="x")
    db.add(user)
    db.commit()
    token = AuthService(db).create_access_token({"sub": str(user.id)})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    assert get_current_user_from_token(creds, db).id == user.id
