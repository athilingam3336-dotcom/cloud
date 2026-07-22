"""
=========================================
CloudCrackers
Refresh Token Repository
=========================================
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:

    @staticmethod
    def create(db: Session, refresh_token: RefreshToken) -> RefreshToken:
        db.add(refresh_token)
        db.commit()
        db.refresh(refresh_token)
        return refresh_token

    @staticmethod
    def get_by_token_hash(db: Session, token_hash: str) -> RefreshToken | None:
        return db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash
        ).first()

    @staticmethod
    def revoke(
        db: Session,
        refresh_token: RefreshToken,
        replaced_by_hash: str | None = None
    ) -> RefreshToken:
        now = datetime.utcnow()
        refresh_token.revoked_at = now
        refresh_token.logout_time = now
        if replaced_by_hash:
            refresh_token.replaced_by_token_hash = replaced_by_hash
        db.commit()
        db.refresh(refresh_token)
        return refresh_token

    @staticmethod
    def revoke_all_for_user(db: Session, user_id: str):
        now = datetime.utcnow()
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None)
        ).update(
            {
                RefreshToken.revoked_at: now,
                RefreshToken.logout_time: now
            },
            synchronize_session=False
        )
        db.commit()
