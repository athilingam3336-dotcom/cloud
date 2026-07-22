"""
=========================================
CloudCrackers
Order APIs
=========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.auth import (
    get_current_user,
    get_admin_user,
    ROLE_PERMISSIONS
)
from app.models.user import User
from app.models.order import Order
from app.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderItemResponse
)
from app.services.order_service import OrderService
from app.repositories.audit_log_repository import AuditLogRepository

router = APIRouter()


def check_order_permission(user: User):
    role_key = "Admin" if user.role == "admin" else user.role
    allowed = ROLE_PERMISSIONS.get(role_key, set())
    if "Orders" not in allowed:
        raise HTTPException(
            status_code=403,
            detail="Permission Denied: 'Orders' permission is required."
        )


@router.post(
    "/",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED
)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = OrderService.create_order(
            db,
            current_user.id,
            data.shipping_address
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    if not order:
        raise HTTPException(
            status_code=400,
            detail="Cart is Empty"
        )

    return order


@router.get(
    "/",
    response_model=list[OrderResponse]
)
def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    admin_roles = {"admin", "Super Admin", "Admin", "Manager", "Staff"}
    if current_user.role in admin_roles:
        check_order_permission(current_user)
        return db.query(Order).order_by(Order.created_at.desc()).all()

    return OrderService.get_orders(
        db,
        current_user.id
    )


@router.get(
    "/{order_id}",
    response_model=OrderResponse
)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    admin_roles = {"admin", "Super Admin", "Admin", "Manager", "Staff"}
    if current_user.role in admin_roles:
        check_order_permission(current_user)
        order = db.query(Order).filter(Order.id == order_id).first()
    else:
        order = OrderService.get_order_by_id(
            db,
            order_id,
            current_user.id
        )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order Not Found"
        )

    return order


@router.get(
    "/{order_id}/items",
    response_model=list[OrderItemResponse]
)
def get_order_items(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    admin_roles = {"admin", "Super Admin", "Admin", "Manager", "Staff"}
    if current_user.role in admin_roles:
        check_order_permission(current_user)
        # Fetch directly without user restriction for admins
        from app.models.order_item import OrderItem
        items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    else:
        items = OrderService.get_order_items(
            db,
            order_id,
            current_user.id
        )

    if items is None:
        raise HTTPException(
            status_code=404,
            detail="Order Not Found"
        )

    return items


@router.put(
    "/cancel/{order_id}",
    response_model=OrderResponse
)
def cancel_order(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify if caller is admin or owner
    admin_roles = {"admin", "Super Admin", "Admin", "Manager", "Staff"}
    if current_user.role in admin_roles:
        check_order_permission(current_user)
        # Admins can cancel any order
        order = db.query(Order).filter(Order.id == order_id).first()
        if order:
            order.order_status = "CANCELLED"
            db.commit()
            db.refresh(order)
    else:
        order = OrderService.cancel_order(
            db,
            order_id,
            current_user.id
        )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order Not Found"
        )

    # Audit log if admin action
    if current_user.role in admin_roles:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        AuditLogRepository.create(
            db,
            event_type="ORDER_CANCELLED",
            user_id=current_user.id,
            ip_address=ip,
            user_agent=ua,
            details=f"Order '{order_id}' cancelled by admin.",
            target_record=order_id
        )

    return order


@router.put(
    "/status/{order_id}",
    response_model=OrderResponse
)
def update_order_status(
    order_id: str,
    data: OrderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    check_order_permission(current_user)

    order = OrderService.update_order_status(
        db,
        order_id,
        data.order_status
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order Not Found"
        )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="ORDER_STATUS_UPDATED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Order status for '{order_id}' set to '{data.order_status}'.",
        target_record=order_id
    )

    return order
