"""
=========================================
CloudCrackers
Cart APIs
=========================================
"""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.middleware.auth import (
    get_current_user
)

from app.models.user import User

from app.schemas.cart import (
    CartCreate,
    CartUpdate,
    CartResponse
)

from app.services.cart_service import (
    CartService
)

router = APIRouter()


@router.post(
    "/",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED
)
def add_to_cart(
    data: CartCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    cart = CartService.add_to_cart(
        db,
        current_user.id,
        data
    )

    if not cart:
        raise HTTPException(
            status_code=404,
            detail="Product Not Found"
        )

    return cart


@router.get(
    "/",
    response_model=list[CartResponse]
)
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return CartService.get_cart(
        db,
        current_user.id
    )


@router.put(
    "/{cart_id}",
    response_model=CartResponse
)
def update_cart(
    cart_id: str,
    data: CartUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    cart = CartService.update_cart(
        db,
        cart_id,
        current_user.id,
        data
    )

    if not cart:
        raise HTTPException(
            status_code=404,
            detail="Cart Item Not Found"
        )

    return cart


@router.delete("/{cart_id}")
def remove_cart_item(
    cart_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    cart = CartService.remove_cart_item(
        db,
        cart_id,
        current_user.id
    )

    if not cart:
        raise HTTPException(
            status_code=404,
            detail="Cart Item Not Found"
        )

    return cart


@router.delete("/")
def clear_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return CartService.clear_cart(
        db,
        current_user.id
    )
