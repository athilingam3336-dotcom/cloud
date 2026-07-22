"""
=========================================
Spin Schemas
=========================================
"""

from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class SpinStatusResponse(BaseModel):
    can_spin: bool
    next_spin_in: Optional[str] = None # e.g., "18h 25m"


class SpinPlayResponse(BaseModel):
    reward_title: str
    reward_type: str
    reward_value: Optional[float] = None
    coupon_code: Optional[str] = None
    angle: int # The angle on the wheel where it stops
    segment_index: Optional[int] = None


class SpinHistoryItem(BaseModel):
    id: str
    reward_title: str
    reward_type: str
    coupon_code: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
