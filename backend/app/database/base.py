"""
=========================================
CloudCrackers
base.py
Register All Database Models
=========================================
"""

from app.database.database import Base

# ==========================================
# Import All Models
# ==========================================

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.spin import SpinHistory
from app.models.cart import Cart
from app.models.wishlist import Wishlist
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment import Payment
from app.models.audit_log import AuditLog
from app.models.revoked_token import RevokedToken
from app.models.settings import StoreSettings

# ==========================================
# Export Base
# ==========================================

__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "Category",
    "Product",
    "ProductImage",
    "Cart",
    "Wishlist",
    "Order",
    "OrderItem",
    "Payment",
    "AuditLog",
    "RevokedToken",
    "StoreSettings",
]