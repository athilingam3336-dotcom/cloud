"""
=========================================
CloudCrackers
User Service
=========================================
"""

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserUpdate, AdminUserUpdate
from app.utils.password import hash_password
from app.repositories.user_repository import UserRepository
from app.utils.xss import sanitize_text


class UserService:

    @staticmethod
    def get_all_users(db: Session):
        return UserRepository.get_all(db)

    @staticmethod
    def get_user_by_id(db: Session, user_id: str):
        return UserRepository.get_by_id(db, user_id)

    @staticmethod
    def update_profile(
        db: Session,
        user_id: str,
        data: UserUpdate
    ):
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            return None

        update_data = data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            if isinstance(value, str) and key in ["first_name", "last_name", "phone"]:
                value = sanitize_text(value)
            setattr(user, key, value)

        try:
            UserRepository.update(db, user)
        except SQLAlchemyError:
            db.rollback()
            raise

        return user

    @staticmethod
    def update_user_admin(
        db: Session,
        user_id: str,
        data: AdminUserUpdate
    ):
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            return None

        update_data = data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            if isinstance(value, str) and key in ["first_name", "last_name", "phone"]:
                value = sanitize_text(value)
            setattr(user, key, value)

        try:
            UserRepository.update(db, user)
        except SQLAlchemyError:
            db.rollback()
            raise

        return user

    @staticmethod
    def reset_password(
        db: Session,
        user_id: str,
        plain_password: str
    ):
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            return None

        user.password_hash = hash_password(plain_password)

        try:
            UserRepository.update(db, user)
        except SQLAlchemyError:
            db.rollback()
            raise

        return user