"""
=========================================
CloudCrackers
Revoked Token Model
=========================================
"""

import uuid
from sqlalchemy import (
    Column,
    String,
    DateTime,
    func
)

from app.database.database import Base


class RevokedToken(Base):

    __tablename__ = "revoked_tokens"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    jti = Column(
        String(255),
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
