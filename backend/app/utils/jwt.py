"""
=========================================
CloudCrackers
JWT Utility
=========================================
"""

import uuid
from datetime import datetime, timedelta
from jose import jwt

from app.core.config import settings


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    payload = {}

    # Convert all values to strings for safety
    for key, value in data.items():
        payload[key] = str(value)

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    payload["exp"] = expire
    payload["jti"] = str(uuid.uuid4())

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_refresh_token(data: dict):
    payload = {}

    for key, value in data.items():
        payload[key] = str(value)

    # Expiration is set to 7 days for the refresh token
    expire = datetime.utcnow() + timedelta(days=7)

    payload["exp"] = expire
    payload["jti"] = str(uuid.uuid4())

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_access_token(token: str):
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )