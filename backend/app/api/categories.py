"""
=========================================
CloudCrackers
Category APIs
=========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.auth import PermissionChecker
from app.models.category import Category
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse
)
from app.repositories.audit_log_repository import AuditLogRepository

router = APIRouter()


@router.post(
    "/",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED
)
def create_category(
    data: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Categories"))
):
    category = Category(**data.model_dump())
    db.add(category)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="A category with this name already exists"
        )

    db.refresh(category)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="CATEGORY_CREATED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Category '{category.category_name}' created.",
        target_record=str(category.id)
    )

    return category


@router.get("/", response_model=list[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db)
):
    return db.query(Category).all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category Not Found"
        )

    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    data: CategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Categories"))
):
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category Not Found"
        )

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="A category with this name already exists"
        )

    db.refresh(category)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="CATEGORY_UPDATED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Category '{category.category_name}' updated.",
        target_record=str(category.id)
    )

    return category


@router.delete("/{category_id}")
def delete_category(
    category_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Categories"))
):
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category Not Found"
        )

    db.delete(category)
    db.commit()

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="CATEGORY_DELETED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Category '{category.category_name}' deleted.",
        target_record=category_id
    )

    return {
        "message": "Category Deleted Successfully"
    }
