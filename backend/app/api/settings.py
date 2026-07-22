"""
=========================================
App Settings APIs
=========================================
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.database import get_db
from app.middleware.auth import PermissionChecker
from app.models.user import User
from app.models.settings import StoreSettings
from app.repositories.audit_log_repository import AuditLogRepository
from app.utils.password import verify_password
from app.utils.totp import verify_totp

router = APIRouter()


class SettingsUpdatePayload(BaseModel):
    storeName: str
    logo: str | None = None
    contactEmail: str
    taxRate: float
    shippingCharge: int
    currency: str
    maintenanceMode: str
    
    # SMTP variables
    smtpServer: str | None = None
    smtpPort: int | None = None
    smtpUsername: str | None = None
    smtpPassword: str | None = None
    
    # Payment key variables
    paymentKeyId: str | None = None
    paymentKeySecret: str | None = None
    
    # Verification details
    confirm_password: str | None = None
    mfa_code: str | None = None
    
    # Wipe trigger
    deleteStore: bool = False


def get_or_create_settings(db: Session) -> StoreSettings:
    settings = db.query(StoreSettings).first()
    if not settings:
        settings = StoreSettings(
            id="default",
            store_name="CloudCrackers",
            contact_email="admin@cloudcrackers.com",
            tax_rate=18.0,
            shipping_charge=80,
            currency="INR",
            maintenance_mode="OFF"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Settings"))
):
    s = get_or_create_settings(db)
    return {
        "storeName": s.store_name,
        "logo": s.logo,
        "contactEmail": s.contact_email,
        "taxRate": s.tax_rate,
        "shippingCharge": s.shipping_charge,
        "currency": s.currency,
        "maintenanceMode": s.maintenance_mode,
        "smtpServer": s.smtp_server or "",
        "smtpPort": s.smtp_port or 587,
        "smtpUsername": s.smtp_username or "",
        "smtpPassword": "********" if s.smtp_password else "",
        "paymentKeyId": s.payment_key_id or "",
        "paymentKeySecret": "********" if s.payment_key_secret else ""
    }


@router.put("/")
def update_settings(
    data: SettingsUpdatePayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Settings"))
):
    s = get_or_create_settings(db)
    critical_change = False

    # Check for critical changes
    if data.smtpServer != s.smtp_server or data.smtpPort != s.smtp_port or data.smtpUsername != s.smtp_username or (data.smtpPassword and data.smtpPassword != "********"):
        critical_change = True

    if data.paymentKeyId != s.payment_key_id or (data.paymentKeySecret and data.paymentKeySecret != "********"):
        critical_change = True

    if data.contactEmail != s.contact_email:
        critical_change = True

    if data.deleteStore:
        critical_change = True

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    if critical_change:
        # Require password check
        if not data.confirm_password or not verify_password(data.confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid admin password verification."
            )

        # Require MFA validation if enabled
        if current_user.mfa_enabled:
            if not data.mfa_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="MFA code verification required for critical action."
                )
            
            code_valid = False
            # Check TOTP
            if current_user.mfa_secret and verify_totp(current_user.mfa_secret, data.mfa_code):
                code_valid = True
            # Check Email OTP
            if not code_valid and current_user.email_otp and current_user.email_otp_expires_at and current_user.email_otp_expires_at > datetime.utcnow():
                if current_user.email_otp == data.mfa_code:
                    code_valid = True
                    current_user.email_otp = None
                    current_user.email_otp_expires_at = None
            # Check Backup Codes
            if not code_valid and current_user.backup_codes:
                hashes = [h.strip() for h in current_user.backup_codes.split(",") if h.strip()]
                for h in hashes:
                    if len(data.mfa_code) == 8 and verify_password(data.mfa_code, h):
                        code_valid = True
                        hashes.remove(h)
                        current_user.backup_codes = ",".join(hashes) if hashes else None
                        break

            if not code_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid MFA verification code."
                )

    # Process Wipe Command
    if data.deleteStore:
        from app.models.product import Product
        from app.models.category import Category
        from app.models.order import Order
        from app.models.order_item import OrderItem
        from app.models.cart import Cart

        db.query(Cart).delete()
        db.query(OrderItem).delete()
        db.query(Order).delete()
        db.query(Product).delete()
        db.query(Category).delete()

        s.store_name = "Cleared Store"
        s.contact_email = "cleared@store.com"
        s.logo = None
        s.smtp_server = None
        s.smtp_port = None
        s.smtp_username = None
        s.smtp_password = None
        s.payment_key_id = None
        s.payment_key_secret = None
        db.commit()

        AuditLogRepository.create(
            db,
            event_type="DELETE_STORE",
            user_id=current_user.id,
            ip_address=ip,
            user_agent=ua,
            details="CRITICAL: wiped all store items (products, orders, categories)."
        )
        return {"message": "Store successfully wiped."}

    # Save regular variables
    s.store_name = data.storeName
    s.contact_email = data.contactEmail
    s.tax_rate = data.taxRate
    s.shipping_charge = data.shippingCharge
    s.currency = data.currency
    s.maintenance_mode = data.maintenanceMode

    # Save logo file safely if updated as base64
    if data.logo and data.logo.startswith("data:image/"):
        from app.utils.file_validator import save_secure_file
        logo_filename = save_secure_file(data.logo)
        s.logo = f"/api/products/images/{logo_filename}"
    elif data.logo == "":
        s.logo = None

    # Save SMTP config fields
    s.smtp_server = data.smtpServer
    s.smtp_port = data.smtpPort
    s.smtp_username = data.smtpUsername
    if data.smtpPassword and data.smtpPassword != "********":
        s.smtp_password = data.smtpPassword

    # Save Razorpay payment fields
    s.payment_key_id = data.paymentKeyId
    if data.paymentKeySecret and data.paymentKeySecret != "********":
        s.payment_key_secret = data.paymentKeySecret

    db.commit()

    AuditLogRepository.create(
        db,
        event_type="SETTINGS_CHANGED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details="Site configurations updated."
    )

    return {"message": "Configurations saved successfully."}
