"""
=========================================
CloudCrackers
Order Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Numeric,
    DateTime,
    Enum,
    ForeignKey,
    func
)

from sqlalchemy.orm import relationship

from app.database.database import Base


class Order(Base):

    __tablename__ = "orders"

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

    total_amount = Column(
        Numeric(10, 2),
        nullable=False
    )

    order_status = Column(
        Enum(
            "PENDING",
            "CONFIRMED",
            "PROCESSING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            name="order_status"
        ),
        default="PENDING",
        nullable=False
    )

    payment_status = Column(
        String(30),
        default="PENDING"
    )

    shipping_address = Column(
        String(500),
        nullable=False
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

    user = relationship("User")

    order_items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    payment = relationship(
        "Payment",
        back_populates="order",
        uselist=False
    )