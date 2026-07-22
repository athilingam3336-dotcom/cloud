"""
=========================================
CloudCrackers
Audit Log Model
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


class AuditLog(Base):

    __tablename__ = "audit_logs"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    user_id = Column(
        String(36),
        nullable=True,
        index=True
    )

    event_type = Column(
        String(100),
        nullable=False,
        index=True
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

    target_record = Column(
        String(255),
        nullable=True
    )

    details = Column(
        String(500),
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )
