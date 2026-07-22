"""
=========================================
CloudCrackers
Cart Service
=========================================
"""

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.cart import Cart
from app.models.product import Product

from app.schemas.cart import (
    CartCreate,
    CartUpdate
)


class CartService:

    @staticmethod
    def add_to_cart(
        db: Session,
        user_id: str,
        data: CartCreate
    ):

        product_id = str(data.product_id)

        product = db.query(Product).filter(
            Product.id == product_id
        ).first()

        if not product:
            return None

        cart = db.query(Cart).filter(
            Cart.user_id == user_id,
            Cart.product_id == product_id
        ).first()

        if cart:
            cart.quantity += data.quantity
        else:
            cart = Cart(
                user_id=user_id,
                product_id=product_id,
                quantity=data.quantity
            )
            db.add(cart)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(cart)

        return cart

    @staticmethod
    def get_cart(
        db: Session,
        user_id: str
    ):

        return db.query(Cart).filter(
            Cart.user_id == user_id
        ).all()

    @staticmethod
    def update_cart(
        db: Session,
        cart_id: str,
        user_id: str,
        data: CartUpdate
    ):

        cart = db.query(Cart).filter(
            Cart.id == cart_id,
            Cart.user_id == user_id
        ).first()

        if not cart:
            return None

        cart.quantity = data.quantity

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(cart)

        return cart

    @staticmethod
    def remove_cart_item(
        db: Session,
        cart_id: str,
        user_id: str
    ):

        cart = db.query(Cart).filter(
            Cart.id == cart_id,
            Cart.user_id == user_id
        ).first()

        if not cart:
            return None

        db.delete(cart)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        return {
            "message": "Item Removed Successfully"
        }

    @staticmethod
    def clear_cart(
        db: Session,
        user_id: str
    ):

        db.query(Cart).filter(
            Cart.user_id == user_id
        ).delete()

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        return {
            "message": "Cart Cleared Successfully"
        }
