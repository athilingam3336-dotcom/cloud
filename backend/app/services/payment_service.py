"""
=========================================
CloudCrackers
Payment Service
=========================================
"""

from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.order import Order
from app.models.payment import Payment


_client = None


def get_razorpay_client():
    global _client

    if _client is None:
        try:
            import razorpay
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Razorpay dependency is not installed correctly"
            ) from exc

        _client = razorpay.Client(
            auth=(
                settings.RAZORPAY_KEY_ID,
                settings.RAZORPAY_KEY_SECRET
            )
        )

    return _client


class PaymentService:

    @staticmethod
    def create_payment(
        db: Session,
        order_id: str
    ):

        order = db.query(Order).filter(
            Order.id == order_id
        ).first()

        if not order:
            return None

        client = get_razorpay_client()

        razorpay_order = client.order.create(
            {
                "amount": int(order.total_amount * 100),
                "currency": "INR",
                "payment_capture": 1
            }
        )

        payment = Payment(
            order_id=order.id,
            razorpay_order_id=razorpay_order["id"],
            amount=order.total_amount,
            payment_status="PENDING"
        )

        db.add(payment)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(payment)

        return payment

    @staticmethod
    def verify_payment(
        db: Session,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ):

        client = get_razorpay_client()

        try:
            client.utility.verify_payment_signature(
                {
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": razorpay_payment_id,
                    "razorpay_signature": razorpay_signature
                }
            )
        except Exception:
            return None

        payment = db.query(Payment).filter(
            Payment.razorpay_order_id == razorpay_order_id
        ).first()

        if not payment:
            return None

        payment.razorpay_payment_id = razorpay_payment_id
        payment.payment_status = "SUCCESS"
        payment.paid_at = datetime.utcnow()

        order = db.query(Order).filter(
            Order.id == payment.order_id
        ).first()

        if not order:
            return None

        order.payment_status = "PAID"
        order.order_status = "CONFIRMED"

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(payment)

        return payment

    @staticmethod
    def get_payment(
        db: Session,
        order_id: str
    ):

        return db.query(Payment).filter(
            Payment.order_id == order_id
        ).first()

    @staticmethod
    def payment_history(
        db: Session
    ):

        return db.query(Payment).order_by(
            Payment.created_at.desc()
        ).all()
