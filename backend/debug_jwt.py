#!/usr/bin/env python3
"""
Debug script for JWT token validation
"""

import sys

sys.path.append("/app")

import jwt
from app.core.auth import SECRET_KEY, AuthService
from app.db.session import get_db_session

# Test token
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQHRhYXNrbWFhc3Rlci5jb20iLCJleHAiOjE3NTYyMzk2ODQsInR5cGUiOiJhY2Nlc3MifQ.cCCOkY5gLSr60rWv33Wrg3dvzWoGkcU8eSjweVClNyw"

print(f"SECRET_KEY: {SECRET_KEY}")

# Test direct JWT decode
try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    print(f"Direct decode: {payload}")
except Exception as e:
    print(f"Direct decode error: {e}")

# Test AuthService verify_token
try:
    db = next(get_db_session())
    auth_service = AuthService(db)
    payload = auth_service.verify_token(token)
    print(f"verify_token: {payload}")
except Exception as e:
    print(f"verify_token error: {e}")
