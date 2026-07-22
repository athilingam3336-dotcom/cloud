"""
=========================================
CloudCrackers
Product Image Model
=========================================
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    func
)

from sqlalchemy.orm import relationship

from app.database.database import Base


class ProductImage(Base):

    __tablename__ = "product_images"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    product_id = Column(
        String(36),
        ForeignKey("products.id"),
        nullable=False
    )

    image_url = Column(
        String(255),
        nullable=False
    )

    is_primary = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    # Relationship
    product = relationship(
        "Product",
        back_populates="images"
    )
