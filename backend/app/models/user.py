"""
=========================================
CloudCrackers
User Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Integer,
    func
)

from app.database.database import Base


class User(Base):

    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    first_name = Column(
        String(100),
        nullable=False
    )

    last_name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    phone = Column(
        String(15),
        nullable=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        default="user",
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    is_verified = Column(
        Boolean,
        default=False,
        nullable=False
    )

    verification_token = Column(
        String(255),
        nullable=True
    )

    verification_token_expires_at = Column(
        DateTime,
        nullable=True
    )

    reset_token = Column(
        String(255),
        nullable=True
    )

    reset_token_expires_at = Column(
        DateTime,
        nullable=True
    )

    failed_login_attempts = Column(
        Integer,
        default=0,
        nullable=False
    )

    locked_until = Column(
        DateTime,
        nullable=True
    )

    mfa_secret = Column(
        String(255),
        nullable=True
    )

    mfa_enabled = Column(
        Boolean,
        default=False,
        nullable=False
    )

    backup_codes = Column(
        String,
        nullable=True
    )

    email_otp = Column(
        String(10),
        nullable=True
    )

    email_otp_expires_at = Column(
        DateTime,
        nullable=True
    )

    failed_mfa_attempts = Column(
        Integer,
        default=0,
        nullable=False
    )

    last_mfa_attempt_at = Column(
        DateTime,
        nullable=True
    )

    password_changed_at = Column(
        DateTime,
        nullable=True
    )

    trusted_browsers = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )