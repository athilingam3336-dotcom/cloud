"""
=========================================
CloudCrackers
Admin Dashboard Schema
=========================================
"""

from datetime import datetime
from pydantic import BaseModel


class RecentActivity(BaseModel):
    id: str
    user_id: str | None
    event_type: str
    ip_address: str | None
    details: str | None
    created_at: datetime
    browser: str | None
    target_record: str | None


class DashboardResponse(BaseModel):
    total_users: int
    total_products: int
    total_categories: int
    total_orders: int
    total_revenue: float
    today_revenue: float
    weekly_revenue: float
    monthly_revenue: float
    pending_orders: int
    delivered_orders: int
    cancelled_orders: int
    active_users: int

    # Zoho Enterprise Security metrics
    active_sessions: int
    failed_login_attempts: int
    suspicious_logins: int
    recent_activities: list[RecentActivity]
    system_health: str
    database_status: str
    storage_usage: str
    api_status: str
