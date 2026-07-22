"""
=========================================
CloudCrackers
Payment Schemas
=========================================
"""

from datetime import datetime

from pydantic import BaseModel


class PaymentRequest(BaseModel):
    order_id: str


class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentResponse(BaseModel):
    id: str
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str | None = None
    amount: float
    payment_method: str | None = None
    payment_status: str
    paid_at: datetime | None = None

    class Config:
        from_attributes = True


class PaymentCreateResponse(BaseModel):
    id: str
    order_id: str
    razorpay_order_id: str
    key_id: str
    amount: int
    currency: str
    payment_status: str