"""
=========================================
CloudCrackers
Order Item Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    ForeignKey
)

from sqlalchemy.orm import relationship

from app.database.database import Base


class OrderItem(Base):

    __tablename__ = "order_items"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    order_id = Column(
        String(36),
        ForeignKey("orders.id"),
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

    price = Column(
        Numeric(10, 2),
        nullable=False
    )

    order = relationship(
        "Order",
        back_populates="order_items"
    )

    product = relationship("Product")