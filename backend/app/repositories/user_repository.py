"""
=========================================
CloudCrackers
User Repository
=========================================
"""

from sqlalchemy.orm import Session
from app.models.user import User


class UserRepository:

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> User | None:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_all(db: Session) -> list[User]:
        return db.query(User).all()

    @staticmethod
    def create(db: Session, user: User) -> User:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update(db: Session, user: User) -> User:
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_by_reset_token(db: Session, token: str) -> User | None:
        return db.query(User).filter(User.reset_token == token).first()

    @staticmethod
    def get_by_verification_token(db: Session, token: str) -> User | None:
        return db.query(User).filter(User.verification_token == token).first()
