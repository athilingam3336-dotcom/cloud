"""
=========================================
CloudCrackers
Cart Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    func
)

from sqlalchemy.orm import relationship

from app.database.database import Base


class Cart(Base):

    __tablename__ = "cart"

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

    quantity = Column(
        Integer,
        nullable=False,
        default=1
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    user = relationship("User")

    product = relationship("Product")