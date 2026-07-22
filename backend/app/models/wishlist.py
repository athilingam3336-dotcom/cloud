"""
=========================================
CloudCrackers
Wishlist Model
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

from sqlalchemy.orm import relationship

from app.database.database import Base


class Wishlist(Base):

    __tablename__ = "wishlist"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False
    )

    product_id = Column(
        String(36),
        ForeignKey("products.id"),
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    user = relationship("User")

    product = relationship("Product")