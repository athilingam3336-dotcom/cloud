"""
=========================================
CloudCrackers
Wishlist Schemas
=========================================
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WishlistBase(BaseModel):
    product_id: UUID


class WishlistCreate(WishlistBase):
    pass


class WishlistResponse(WishlistBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True