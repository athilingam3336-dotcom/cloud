"""
=========================================
CloudCrackers
Order Service
=========================================
"""

from decimal import Decimal
from uuid import uuid4

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.cart import Cart
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product


class OrderService:

    @staticmethod
    def create_order(
        db: Session,
        user_id: str,
        shipping_address: str
    ):

        cart_items = db.query(Cart).filter(
            Cart.user_id == user_id
        ).all()

        if not cart_items:
            return None

        total_amount = Decimal("0.00")

        for item in cart_items:

            product = db.query(Product).filter(
                Product.id == item.product_id
            ).first()

            if not product:
                continue

            if product.stock_quantity < item.quantity:
                raise ValueError(
                    f"Insufficient stock for '{product.product_name}'. "
                    f"Available: {product.stock_quantity}, Requested: {item.quantity}"
                )

            total_amount += (
                product.price * item.quantity
            )

        order = Order(
            id=str(uuid4()),
            user_id=user_id,
            total_amount=total_amount,
            shipping_address=shipping_address,
            order_status="PENDING",
            payment_status="PENDING"
        )

        db.add(order)
        db.flush()

        for item in cart_items:

            product = db.query(Product).filter(
                Product.id == item.product_id
            ).first()

            if not product:
                continue

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item.quantity,
                price=product.price
            )

            db.add(order_item)

            product.stock_quantity -= item.quantity

        db.query(Cart).filter(
            Cart.user_id == user_id
        ).delete()

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(order)

        return order

    @staticmethod
    def get_orders(
        db: Session,
        user_id: str
    ):

        return db.query(Order).filter(
            Order.user_id == user_id
        ).order_by(
            Order.created_at.desc()
        ).all()

    @staticmethod
    def get_order_by_id(
        db: Session,
        order_id: str,
        user_id: str
    ):

        return db.query(Order).filter(
            Order.id == order_id,
            Order.user_id == user_id
        ).first()

    @staticmethod
    def get_order_items(
        db: Session,
        order_id: str,
        user_id: str
    ):

        order = db.query(Order).filter(
            Order.id == order_id,
            Order.user_id == user_id
        ).first()

        if not order:
            return None

        return db.query(OrderItem).filter(
            OrderItem.order_id == order_id
        ).all()

    @staticmethod
    def update_order_status(
        db: Session,
        order_id: str,
        status: str
    ):

        order = db.query(Order).filter(
            Order.id == order_id
        ).first()

        if not order:
            return None

        order.order_status = status

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(order)

        return order

    @staticmethod
    def cancel_order(
        db: Session,
        order_id: str,
        user_id: str
    ):

        order = db.query(Order).filter(
            Order.id == order_id,
            Order.user_id == user_id
        ).first()

        if not order:
            return None

        order.order_status = "CANCELLED"

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(order)

        return order
