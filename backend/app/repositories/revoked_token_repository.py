"""
=========================================
CloudCrackers
Revoked Token Repository
=========================================
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.models.revoked_token import RevokedToken


class RevokedTokenRepository:

    @staticmethod
    def add(db: Session, jti: str, expires_at: datetime) -> RevokedToken:
        rev_token = RevokedToken(jti=jti, expires_at=expires_at)
        db.add(rev_token)
        db.commit()
        db.refresh(rev_token)
        return rev_token

    @staticmethod
    def is_blacklisted(db: Session, jti: str) -> bool:
        # Automatically prune expired records to maintain database efficiency
        try:
            db.query(RevokedToken).filter(
                RevokedToken.expires_at < datetime.utcnow()
            ).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()

        token = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
        return token is not None
