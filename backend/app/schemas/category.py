"""
=========================================
CloudCrackers
Category Schemas
=========================================
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class CategoryBase(BaseModel):
    category_name: str
    description: str | None = None
    category_image: str | None = None
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    category_name: str | None = None
    description: str | None = None
    category_image: str | None = None
    status: Literal["ACTIVE", "INACTIVE"] | None = None


class CategoryResponse(CategoryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True