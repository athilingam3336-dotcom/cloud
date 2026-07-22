"""
=========================================
SpinHistory Model
=========================================
"""

import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database.database import Base


class SpinHistory(Base):
    __tablename__ = "spin_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # What the user won
    reward_title = Column(String(100), nullable=False)
    reward_type = Column(String(50), nullable=False) # e.g., "discount", "flat", "better_luck"
    reward_value = Column(Float, nullable=True) # e.g., 10 for 10%
    
    # Generated coupon code
    coupon_code = Column(String(50), nullable=True)
    
    # Log time
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="spins")
