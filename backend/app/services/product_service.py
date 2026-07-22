"""
=========================================
CloudCrackers
Product Service
=========================================
"""

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.product import Product

from app.schemas.product import (
    ProductCreate,
    ProductUpdate
)


class ProductService:

    @staticmethod
    def create_product(
        db: Session,
        data: ProductCreate
    ):

        product = Product(
            category_id=str(data.category_id),
            product_name=data.product_name,
            description=data.description,
            price=data.price,
            stock_quantity=data.stock_quantity,
            product_image=data.product_image,
            status=data.status,
            discount=data.discount,
            weight=data.weight,
            sku=data.sku,
            brand=data.brand
        )

        db.add(product)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(product)

        return product

    @staticmethod
    def get_all_products(
        db: Session,
        category: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None
    ):

        query = db.query(Product)

        if category:
            query = query.filter(
                Product.category_id == category
            )

        if min_price is not None:
            query = query.filter(
                Product.price >= min_price
            )

        if max_price is not None:
            query = query.filter(
                Product.price <= max_price
            )

        return query.all()

    @staticmethod
    def search_products(
        db: Session,
        q: str
    ):

        return db.query(Product).filter(
            Product.product_name.ilike(f"%{q}%")
        ).all()

    @staticmethod
    def get_product_by_id(
        db: Session,
        product_id: str
    ):

        return db.query(Product).filter(
            Product.id == product_id
        ).first()

    @staticmethod
    def update_product(
        db: Session,
        product_id: str,
        data: ProductUpdate
    ):

        product = db.query(Product).filter(
            Product.id == product_id
        ).first()

        if not product:

            return None

        update_data = data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            if key == "category_id" and value is not None:
                setattr(product, key, str(value))
            else:
                setattr(product, key, value)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        db.refresh(product)

        return product

    @staticmethod
    def delete_product(
        db: Session,
        product_id: str
    ):

        product = db.query(Product).filter(
            Product.id == product_id
        ).first()

        if not product:

            return None

        db.delete(product)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        return {
            "message": "Product Deleted Successfully"
        }
