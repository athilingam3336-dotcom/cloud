"""
=========================================
CloudCrackers
Wishlist Service
=========================================
"""

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.wishlist import Wishlist
from app.models.product import Product


class WishlistService:

    @staticmethod
    def add_to_wishlist(
        db: Session,
        user_id: str,
        product_id
    ):

        product_id = str(product_id)

        product = db.query(Product).filter(
            Product.id == product_id
        ).first()

        if not product:
            return None

        wishlist = db.query(Wishlist).filter(
            Wishlist.user_id == user_id,
            Wishlist.product_id == product_id
        ).first()

        if wishlist:
            return wishlist

        wishlist = Wishlist(
            user_id=user_id,
            product_id=product_id
        )

        db.add(wishlist)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(wishlist)

        return wishlist

    @staticmethod
    def get_wishlist(
        db: Session,
        user_id: str
    ):

        return db.query(Wishlist).filter(
            Wishlist.user_id == user_id
        ).all()

    @staticmethod
    def remove_from_wishlist(
        db: Session,
        wishlist_id: str,
        user_id: str
    ):

        wishlist = db.query(Wishlist).filter(
            Wishlist.id == wishlist_id,
            Wishlist.user_id == user_id
        ).first()

        if not wishlist:
            return None

        db.delete(wishlist)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        return {
            "message": "Wishlist Item Removed Successfully"
        }

    @staticmethod
    def clear_wishlist(
        db: Session,
        user_id: str
    ):

        db.query(Wishlist).filter(
            Wishlist.user_id == user_id
        ).delete()

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        return {
            "message": "Wishlist Cleared Successfully"
        }
