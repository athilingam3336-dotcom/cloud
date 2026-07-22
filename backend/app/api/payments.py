"""
=========================================
CloudCrackers
Payment APIs
=========================================
"""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from sqlalchemy.orm import Session

from app.core.config import settings

from app.database.database import get_db

from app.middleware.auth import (
    get_current_user,
    get_admin_user
)

from app.models.user import User

from app.schemas.payment import (
    PaymentRequest,
    PaymentVerify,
    PaymentResponse,
    PaymentCreateResponse
)

from app.services.payment_service import (
    PaymentService
)

router = APIRouter()


# ==========================================
# Create Razorpay Order
# ==========================================

@router.post(
    "/create",
    response_model=PaymentCreateResponse,
    status_code=status.HTTP_201_CREATED
)
def create_payment(
    data: PaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    try:
        payment = PaymentService.create_payment(
            db,
            str(data.order_id)
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

    if not payment:

        raise HTTPException(
            status_code=404,
            detail="Order Not Found"
        )

    return PaymentCreateResponse(
        id=str(payment.id),
        order_id=str(payment.order_id),
        razorpay_order_id=payment.razorpay_order_id,
        key_id=settings.RAZORPAY_KEY_ID,
        amount=int(round(payment.amount * 100)),
        currency="INR",
        payment_status=payment.payment_status
    )


# ==========================================
# Verify Payment
# ==========================================

@router.post(
    "/verify",
    response_model=PaymentResponse
)
def verify_payment(
    data: PaymentVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    try:
        payment = PaymentService.verify_payment(
            db,
            data.razorpay_order_id,
            data.razorpay_payment_id,
            data.razorpay_signature
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

    if not payment:

        raise HTTPException(
            status_code=400,
            detail="Payment Verification Failed"
        )

    return payment


# ==========================================
# Payment History (Admin)
# ==========================================

@router.get(
    "/history/all",
    response_model=list[PaymentResponse]
)
def payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):

    return PaymentService.payment_history(db)


# ==========================================
# Payment Details
# ==========================================

@router.get(
    "/{order_id}",
    response_model=PaymentResponse
)
def get_payment(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    payment = PaymentService.get_payment(
        db,
        order_id
    )

    if not payment:

        raise HTTPException(
            status_code=404,
            detail="Payment Not Found"
        )

    return payment
