"""
=========================================
Spin Service
=========================================
"""

import random
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.models.spin import SpinHistory
from app.schemas.spin import SpinStatusResponse, SpinPlayResponse


class SpinService:
    # Define wheel segments (8 segments = 45 degrees each)
    WHEEL_REWARDS = [
        {"title": "₹50 OFF", "type": "discount", "value": 50.0, "weight": 20, "index": 0},
        {"title": "₹100 OFF", "type": "discount", "value": 100.0, "weight": 15, "index": 1},
        {"title": "Free Shipping", "type": "shipping", "value": 0.0, "weight": 15, "index": 2},
        {"title": "5% OFF", "type": "percent", "value": 5.0, "weight": 18, "index": 3},
        {"title": "₹200 OFF", "type": "discount", "value": 200.0, "weight": 7, "index": 4},
        {"title": "10% OFF", "type": "percent", "value": 10.0, "weight": 10, "index": 5},
        {"title": "Better Luck", "type": "none", "value": 0.0, "weight": 10, "index": 6},
        {"title": "Surprise Gift 🎉", "type": "gift", "value": 0.0, "weight": 5, "index": 7},
    ]

    @staticmethod
    def get_status(db: Session, user_id: str) -> SpinStatusResponse:
        """Check if the user can spin today."""
        last_spin = db.query(SpinHistory).filter(SpinHistory.user_id == user_id).order_by(SpinHistory.created_at.desc()).first()
        
        if not last_spin:
            return SpinStatusResponse(can_spin=True)

        now = datetime.now(timezone.utc)
        
        # Make created_at timezone aware if it's naive
        last_spin_time = last_spin.created_at
        if last_spin_time.tzinfo is None:
            last_spin_time = last_spin_time.replace(tzinfo=timezone.utc)

        time_since_last = now - last_spin_time
        
        if time_since_last < timedelta(hours=24):
            time_left = timedelta(hours=24) - time_since_last
            hours, remainder = divmod(time_left.seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            # Add days to hours if any
            hours += time_left.days * 24
            
            return SpinStatusResponse(
                can_spin=False,
                next_spin_in=f"{hours}h {minutes}m"
            )
            
        return SpinStatusResponse(can_spin=True)

    @staticmethod
    def play(db: Session, user_id: str) -> SpinPlayResponse:
        """Execute a spin and store the result."""
        status = SpinService.get_status(db, user_id)
        if not status.can_spin:
            raise ValueError("You've already used today's spin.")

        # Select reward based on weights
        population = SpinService.WHEEL_REWARDS
        weights = [r["weight"] for r in population]
        reward = random.choices(population, weights=weights, k=1)[0]

        coupon_code = None
        if reward["type"] != "none":
            # Generate a random 6-character coupon
            coupon_code = f"SPIN{secrets.token_hex(3).upper()}"

        # Save to DB
        new_spin = SpinHistory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            reward_title=reward["title"],
            reward_type=reward["type"],
            reward_value=reward["value"],
            coupon_code=coupon_code,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_spin)
        db.commit()

        # Calculate precise stop angle in degrees so that the segment's midpoint lands at the top (270 degrees)
        segment_mid = reward["index"] * 45 + 22.5
        base_rotation = (270 - segment_mid) % 360
        stop_angle = int(base_rotation + (360 * 5))

        return SpinPlayResponse(
            reward_title=reward["title"],
            reward_type=reward["type"],
            reward_value=reward["value"],
            coupon_code=coupon_code,
            angle=stop_angle,
            segment_index=reward["index"]
        )

    @staticmethod
    def get_history(db: Session, user_id: str):
        return db.query(SpinHistory).filter(SpinHistory.user_id == user_id).order_by(SpinHistory.created_at.desc()).all()
