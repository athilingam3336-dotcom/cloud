"""
=========================================
CloudCrackers
Product Schemas
=========================================
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    category_id: UUID
    product_name: str
    description: str | None = None
    price: float = Field(gt=0)
    stock_quantity: int = Field(ge=0)
    product_image: str | None = None
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"
    discount: float = 0.00
    weight: str | None = None
    sku: str | None = None
    brand: str = "CloudCrackers"


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    product_image: str | None = None
    status: Literal["ACTIVE", "INACTIVE"] | None = None
    category_id: UUID | None = None
    discount: float | None = Field(default=None, ge=0)
    weight: str | None = None
    sku: str | None = None
    brand: str | None = None


class ProductImageResponse(BaseModel):
    id: UUID
    product_id: UUID
    image_url: str
    is_primary: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductImageUploadSchema(BaseModel):
    image_data: str
    is_primary: bool = False


class ProductResponse(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    images: list[ProductImageResponse] = []

    class Config:
        from_attributes = True