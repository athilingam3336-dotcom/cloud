"""
=========================================
CloudCrackers
Cart Schemas
=========================================
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CartBase(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)


class CartCreate(CartBase):
    pass


class CartUpdate(BaseModel):
    quantity: int = Field(gt=0)


class CartResponse(CartBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True