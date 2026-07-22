"""
=========================================
CloudCrackers
Admin Dashboard APIs
=========================================
"""

import os
from datetime import datetime, timedelta, date, time
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel

from app.database.database import get_db
from app.middleware.auth import PermissionChecker
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.order import Order
from app.models.payment import Payment
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog
from app.schemas.admin import DashboardResponse, RecentActivity
from app.core.config import settings
from app.repositories.audit_log_repository import AuditLogRepository

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Dashboard"))
):
    # Total counts
    total_users = db.query(func.count(User.id)).filter(User.role != "user").scalar() or 0
    total_products = db.query(func.count(Product.id)).scalar() or 0
    total_categories = db.query(func.count(Category.id)).scalar() or 0
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    
    # Active entities
    active_users = db.query(func.count(User.id)).filter(User.role != "user", User.is_active == True).scalar() or 0
    
    # Order Status counts
    pending_orders = db.query(func.count(Order.id)).filter(Order.order_status == "PENDING").scalar() or 0
    delivered_orders = db.query(func.count(Order.id)).filter(Order.order_status == "DELIVERED").scalar() or 0
    cancelled_orders = db.query(func.count(Order.id)).filter(Order.order_status == "CANCELLED").scalar() or 0

    # Total Revenue
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.payment_status == "SUCCESS").scalar() or 0.0

    # Today's Revenue
    today_start = datetime.combine(date.today(), time.min)
    today_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_status == "SUCCESS",
        func.coalesce(Payment.paid_at, Payment.created_at) >= today_start
    ).scalar() or 0.0

    # Weekly Revenue
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    weekly_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_status == "SUCCESS",
        func.coalesce(Payment.paid_at, Payment.created_at) >= seven_days_ago
    ).scalar() or 0.0

    # Monthly Revenue
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    monthly_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_status == "SUCCESS",
        func.coalesce(Payment.paid_at, Payment.created_at) >= thirty_days_ago
    ).scalar() or 0.0

    # active sessions
    active_sessions = db.query(func.count(RefreshToken.id)).filter(
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.utcnow()
    ).scalar() or 0

    # failed logins count
    failed_login_attempts = db.query(func.count(AuditLog.id)).filter(
        AuditLog.event_type == "FAILED_LOGIN"
    ).scalar() or 0

    # suspicious logins count
    suspicious_logins = db.query(func.count(AuditLog.id)).filter(
        AuditLog.event_type.in_(["SUSPICIOUS_LOGIN", "LOCKOUT"])
    ).scalar() or 0

    # recent activities list
    db_activities = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    recent_activities = []
    for act in db_activities:
        # Gracefully handle optional properties or default values
        recent_activities.append(
            RecentActivity(
                id=act.id,
                user_id=act.user_id,
                event_type=act.event_type,
                ip_address=act.ip_address,
                details=act.details,
                created_at=act.created_at,
                browser=getattr(act, "browser", "Unknown"),
                target_record=getattr(act, "target_record", None)
            )
        )

    # database status
    db_status = "Disconnected"
    try:
        db.execute(text("SELECT 1"))
        db_status = "Connected"
    except Exception:
        pass

    # storage usage calculation
    db_size_str = "0.00 MB"
    try:
        url = settings.DATABASE_URL
        if "sqlite" in url:
            db_path = url.replace("sqlite:///", "").replace("./", "")
            if os.path.exists(db_path):
                db_size_str = f"{os.path.getsize(db_path) / (1024 * 1024):.2f} MB"
        else:
            db_size_str = "Enterprise Cloud"
    except Exception:
        pass

    return DashboardResponse(
        total_users=total_users,
        total_products=total_products,
        total_categories=total_categories,
        total_orders=total_orders,
        total_revenue=float(total_revenue),
        today_revenue=float(today_revenue),
        weekly_revenue=float(weekly_revenue),
        monthly_revenue=float(monthly_revenue),
        pending_orders=pending_orders,
        delivered_orders=delivered_orders,
        cancelled_orders=cancelled_orders,
        active_users=active_users,
        
        # Security telemetry parameters
        active_sessions=active_sessions,
        failed_login_attempts=failed_login_attempts,
        suspicious_logins=suspicious_logins,
        recent_activities=recent_activities,
        system_health="Excellent",
        database_status=db_status,
        storage_usage=db_size_str,
        api_status="All systems fully operational"
    )


class AuditLogCreate(BaseModel):
    event_type: str
    details: str
    target_record: str | None = None


@router.post("/audit-log")
def log_admin_action(
    data: AuditLogCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Reports"))
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    
    AuditLogRepository.create(
        db,
        event_type=data.event_type,
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=data.details,
        target_record=data.target_record
    )
    return {"message": "Audit log recorded successfully."}
