"""
=========================================
CloudCrackers
Order Schemas
=========================================
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class OrderBase(BaseModel):
    shipping_address: str


class OrderCreate(OrderBase):
    pass


class OrderUpdate(BaseModel):
    order_status: Literal[
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED"
    ]


class OrderResponse(BaseModel):
    id: UUID
    user_id: UUID
    total_amount: float
    order_status: str
    payment_status: str
    shipping_address: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    quantity: int
    price: float

    class Config:
        from_attributes = True