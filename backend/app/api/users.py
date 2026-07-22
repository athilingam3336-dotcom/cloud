"""
=========================================
CloudCrackers
User APIs
=========================================
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.auth import get_current_user, PermissionChecker
from app.models.user import User
from app.schemas.user import (
    UserUpdate,
    AdminUserUpdate,
    ResetPasswordRequest,
    UserResponse
)
from app.services.user_service import UserService
from app.repositories.audit_log_repository import AuditLogRepository

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.put(
    "/me",
    response_model=UserResponse
)
def update_my_profile(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = UserService.update_profile(
        db,
        current_user.id,
        data
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User Not Found"
        )

    return user


# ==========================================
# Admin User Management Routes
# ==========================================

@router.get(
    "/",
    response_model=list[UserResponse]
)
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Users"))
):
    return UserService.get_all_users(db)


@router.get(
    "/{id}",
    response_model=UserResponse
)
def get_user_by_id(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Users"))
):
    user = UserService.get_user_by_id(db, id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User Not Found"
        )
    return user


@router.put(
    "/{id}",
    response_model=UserResponse
)
def update_user(
    id: str,
    data: AdminUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Users"))
):
    user = UserService.update_user_admin(db, id, data)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User Not Found"
        )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="ADMIN_USER_UPDATED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Admin updated user role/status for user ID '{id}'.",
        target_record=id
    )

    return user


@router.put(
    "/{id}/reset-password",
    response_model=UserResponse
)
def reset_user_password(
    id: str,
    data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Users"))
):
    user = UserService.reset_password(db, id, data.password)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User Not Found"
        )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="ADMIN_USER_PASSWORD_RESET",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Admin reset password for user ID '{id}'.",
        target_record=id
    )

    return user