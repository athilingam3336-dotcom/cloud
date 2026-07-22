"""
=========================================
Spin APIs
=========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.spin import SpinStatusResponse, SpinPlayResponse, SpinHistoryItem
from app.services.spin_service import SpinService

router = APIRouter()


@router.get(
    "/status",
    response_model=SpinStatusResponse
)
def get_spin_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return SpinService.get_status(db, current_user.id)


@router.post(
    "/play",
    response_model=SpinPlayResponse
)
def play_spin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return SpinService.play(db, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/history",
    response_model=list[SpinHistoryItem]
)
def get_spin_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return SpinService.get_history(db, current_user.id)
