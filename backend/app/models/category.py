"""
=========================================
CloudCrackers
Category Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Enum,
    func
)

from sqlalchemy.orm import relationship

from app.database.database import Base


class Category(Base):

    __tablename__ = "categories"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    category_name = Column(
        String(100),
        nullable=False,
        unique=True
    )

    description = Column(
        Text,
        nullable=True
    )

    category_image = Column(
        String(255),
        nullable=True
    )

    status = Column(
        Enum("ACTIVE", "INACTIVE", name="category_status"),
        nullable=False,
        default="ACTIVE"
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

    # Relationship
    products = relationship(
        "Product",
        back_populates="category",
        cascade="all, delete"
    )