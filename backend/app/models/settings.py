"""
=========================================
CloudCrackers
Store Settings Model
=========================================
"""

from sqlalchemy import Column, String, Float, Integer
from app.database.database import Base


class StoreSettings(Base):
    __tablename__ = "store_settings"

    id = Column(
        String(36),
        primary_key=True,
        default="default"
    )

    store_name = Column(
        String(255),
        nullable=False,
        default="CloudCrackers"
    )

    logo = Column(
        String(255),
        nullable=True
    )

    contact_email = Column(
        String(255),
        nullable=False,
        default="admin@cloudcrackers.com"
    )

    tax_rate = Column(
        Float,
        nullable=False,
        default=18.0
    )

    shipping_charge = Column(
        Integer,
        nullable=False,
        default=80
    )

    currency = Column(
        String(10),
        nullable=False,
        default="INR"
    )

    maintenance_mode = Column(
        String(10),
        nullable=False,
        default="OFF"
    )

    # SMTP variables
    smtp_server = Column(
        String(255),
        nullable=True
    )

    smtp_port = Column(
        Integer,
        nullable=True
    )

    smtp_username = Column(
        String(255),
        nullable=True
    )

    smtp_password = Column(
        String(255),
        nullable=True
    )

    # Payment configuration variables
    payment_key_id = Column(
        String(255),
        nullable=True
    )

    payment_key_secret = Column(
        String(255),
        nullable=True
    )
