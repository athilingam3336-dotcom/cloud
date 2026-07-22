"""
=========================================
CloudCrackers
Authentication Schemas
=========================================
"""

import re
from pydantic import BaseModel, EmailStr, Field, field_validator


def validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one number.")
    special_chars = re.compile(r"[@$!%*?&#]")
    if not special_chars.search(password):
        raise ValueError("Password must contain at least one special character (@$!%*?&#).")
    return password


# ==========================================
# Register Request
# ==========================================

class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str | None = None
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


# ==========================================
# Login Request
# ==========================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ==========================================
# JWT Token Response
# ==========================================

class TokenResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: str | None = None
    mfa_method: str | None = None


# ==========================================
# Token Payload
# ==========================================

class TokenData(BaseModel):
    email: str | None = None


# ==========================================
# Token Refresh Request
# ==========================================

class TokenRefreshRequest(BaseModel):
    refresh_token: str


# ==========================================
# Forgot Password Request
# ==========================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# ==========================================
# Reset Password Request
# ==========================================

class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


# ==========================================
# Message Response
# ==========================================

class MessageResponse(BaseModel):
    message: str


# ==========================================
# MFA Verify Request
# ==========================================

class MfaVerifyRequest(BaseModel):
    mfa_token: str
    code: str