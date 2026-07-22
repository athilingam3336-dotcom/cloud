"""
=========================================
CloudCrackers
Refresh Token Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    func
)

from app.database.database import Base


class RefreshToken(Base):

    __tablename__ = "refresh_tokens"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    token_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    revoked_at = Column(
        DateTime,
        nullable=True
    )

    replaced_by_token_hash = Column(
        String(64),
        nullable=True
    )

    ip_address = Column(
        String(45),
        nullable=True
    )

    user_agent = Column(
        String(255),
        nullable=True
    )

    browser = Column(
        String(100),
        nullable=True
    )

    os = Column(
        String(100),
        nullable=True
    )

    device = Column(
        String(100),
        nullable=True
    )

    login_time = Column(
        DateTime,
        nullable=True
    )

    logout_time = Column(
        DateTime,
        nullable=True
    )
