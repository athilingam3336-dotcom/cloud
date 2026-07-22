"""
=========================================
CloudCrackers
Wishlist APIs
=========================================
"""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.middleware.auth import get_current_user

from app.models.user import User

from app.schemas.wishlist import (
    WishlistCreate,
    WishlistResponse
)

from app.services.wishlist_service import WishlistService

router = APIRouter()


@router.post(
    "/",
    response_model=WishlistResponse,
    status_code=status.HTTP_201_CREATED
)
def add_to_wishlist(
    data: WishlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    wishlist = WishlistService.add_to_wishlist(
        db,
        current_user.id,
        data.product_id
    )

    if not wishlist:
        raise HTTPException(
            status_code=404,
            detail="Product Not Found"
        )

    return wishlist


@router.get(
    "/",
    response_model=list[WishlistResponse]
)
def get_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return WishlistService.get_wishlist(
        db,
        current_user.id
    )


@router.delete("/{wishlist_id}")
def remove_from_wishlist(
    wishlist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    wishlist = WishlistService.remove_from_wishlist(
        db,
        wishlist_id,
        current_user.id
    )

    if not wishlist:
        raise HTTPException(
            status_code=404,
            detail="Wishlist Item Not Found"
        )

    return wishlist


@router.delete("/")
def clear_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return WishlistService.clear_wishlist(
        db,
        current_user.id
    )
