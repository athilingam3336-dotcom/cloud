"""
=========================================
CloudCrackers
Product Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Numeric,
    DateTime,
    Enum,
    ForeignKey,
    func
)

from sqlalchemy.orm import relationship

from app.database.database import Base


class Product(Base):

    __tablename__ = "products"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    category_id = Column(
        String(36),
        ForeignKey("categories.id"),
        nullable=False
    )

    product_name = Column(
        String(255),
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    price = Column(
        Numeric(10, 2),
        nullable=False
    )

    stock_quantity = Column(
        Integer,
        nullable=False
    )

    product_image = Column(
        String(255),
        nullable=True
    )

    status = Column(
        Enum("ACTIVE", "INACTIVE", name="product_status"),
        default="ACTIVE",
        nullable=False
    )

    discount = Column(
        Numeric(10, 2),
        default=0.00,
        nullable=False
    )

    weight = Column(
        String(50),
        nullable=True
    )

    sku = Column(
        String(100),
        nullable=True,
        unique=True
    )

    brand = Column(
        String(100),
        default="CloudCrackers",
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


    # Relationships
    category = relationship(
        "Category",
        back_populates="products"
    )

    images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan"
    )