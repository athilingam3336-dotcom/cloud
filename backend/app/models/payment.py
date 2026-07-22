"""
=========================================
CloudCrackers
Payment Model
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


class Payment(Base):

    __tablename__ = "payments"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    order_id = Column(
        String(36),
        ForeignKey("orders.id"),
        nullable=False,
        unique=True
    )

    razorpay_order_id = Column(
        String(255),
        nullable=False
    )

    razorpay_payment_id = Column(
        String(255),
        nullable=True
    )

    razorpay_signature = Column(
        String(255),
        nullable=True
    )

    amount = Column(
        Numeric(10, 2),
        nullable=False
    )

    payment_method = Column(
        String(50),
        nullable=True
    )

    payment_status = Column(
        Enum(
            "PENDING",
            "SUCCESS",
            "FAILED",
            name="payment_status"
        ),
        default="PENDING",
        nullable=False
    )

    paid_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    order = relationship(
        "Order",
        back_populates="payment"
    )