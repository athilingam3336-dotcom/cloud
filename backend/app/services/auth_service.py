"""
=========================================
Authentication Service
=========================================
"""

import uuid
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterRequest
from app.repositories.user_repository import UserRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.revoked_token_repository import RevokedTokenRepository
from app.utils.password import hash_password, verify_password
from app.utils.xss import sanitize_text
from app.utils.jwt import create_access_token

logger = logging.getLogger("cloudcrackers")

# Simulated emails path inside the backend directory
BACKEND_DIR = Path(__file__).resolve().parents[2]
SIMULATED_EMAILS_LOG = BACKEND_DIR / "simulated_emails.log"


def send_simulated_email(email_type: str, recipient: str, subject: str, body: str):
    """
    Simulates sending an email by writing it to backend/simulated_emails.log.
    """
    try:
        with open(SIMULATED_EMAILS_LOG, "a", encoding="utf-8") as f:
            f.write("=========================================\n")
            f.write(f"TIMESTAMP: {datetime.utcnow().isoformat()}\n")
            f.write(f"TYPE: {email_type}\n")
            f.write(f"RECIPIENT: {recipient}\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"BODY:\n{body}\n")
            f.write("=========================================\n\n")
    except Exception as e:
        logger.error(f"Failed to write simulated email to log: {e}")


class AuthService:

    @staticmethod
    def register(db: Session, data: RegisterRequest, ip_address: str | None = None, user_agent: str | None = None) -> User | None:
        # Sanitize name and phone inputs to protect against XSS
        first_name = sanitize_text(data.first_name)
        last_name = sanitize_text(data.last_name)
        phone = sanitize_text(data.phone) if data.phone else None

        # Check existing user
        user = UserRepository.get_by_email(db, data.email)
        if user:
            AuditLogRepository.create(
                db,
                event_type="REGISTER_FAILED_DUPLICATE",
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Registration attempt failed: Email {data.email} already exists."
            )
            return None

        # Generate verification token
        verification_token = str(uuid.uuid4())
        verification_token_expires_at = datetime.utcnow() + timedelta(hours=24)

        new_user = User(
            first_name=first_name,
            last_name=last_name,
            email=data.email,
            phone=phone,
            password_hash=hash_password(data.password),
            is_verified=False,
            verification_token=verification_token,
            verification_token_expires_at=verification_token_expires_at
        )

        try:
            UserRepository.create(db, new_user)
        except SQLAlchemyError:
            db.rollback()
            raise

        AuditLogRepository.create(
            db,
            event_type="REGISTER_SUCCESS",
            user_id=new_user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"User {data.email} registered successfully."
        )

        # Send simulated email
        verify_link = f"http://127.0.0.1:8000/pages/verify-email.html?token={verification_token}"
        body = (
            f"Hello {first_name},\n\n"
            f"Welcome to CloudCrackers! Please verify your email by clicking the following link:\n"
            f"{verify_link}\n\n"
            f"This link will expire in 24 hours."
        )
        send_simulated_email("EMAIL_VERIFICATION", data.email, "Verify Your CloudCrackers Email", body)

        return new_user

    @staticmethod
    def verify_email(db: Session, token: str, ip_address: str | None = None, user_agent: str | None = None) -> bool:
        user = UserRepository.get_by_verification_token(db, token)
        if not user:
            AuditLogRepository.create(
                db,
                event_type="EMAIL_VERIFY_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                details="Email verification failed: Invalid token."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token."
            )

        if user.verification_token_expires_at and user.verification_token_expires_at < datetime.utcnow():
            AuditLogRepository.create(
                db,
                event_type="EMAIL_VERIFY_FAILED",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details="Email verification failed: Token expired."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token."
            )

        user.is_verified = True
        user.verification_token = None
        user.verification_token_expires_at = None

        try:
            UserRepository.update(db, user)
        except SQLAlchemyError:
            db.rollback()
            raise

        AuditLogRepository.create(
            db,
            event_type="EMAIL_VERIFY_SUCCESS",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Email verified successfully for {user.email}."
        )

        return True

    @staticmethod
    def authenticate(db: Session, email: str, password: str, ip_address: str | None = None, user_agent: str | None = None) -> User:
        user = UserRepository.get_by_email(db, email)

        # Mitigate timing attacks by performing a dummy hash verification if the user doesn't exist
        if not user:
            dummy_hash = "$2b$12$Lty273o1GpxP0J3nKscvI.P/1x9w8Z5rGfeRreZ03lB5H8KjVbMwe"
            verify_password(password, dummy_hash)
            AuditLogRepository.create(
                db,
                event_type="LOGIN_FAILED_USER_NOT_FOUND",
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Login attempt failed: user {email} not found."
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )

        # Check account lock status
        if user.locked_until and user.locked_until > datetime.utcnow():
            AuditLogRepository.create(
                db,
                event_type="LOGIN_FAILED_LOCKED",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Login attempt failed: account {email} is locked."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been temporarily locked due to too many failed login attempts. Please try again later."
            )

        # Verify password
        if not verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                AuditLogRepository.create(
                    db,
                    event_type="LOCKOUT",
                    user_id=user.id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=f"Account locked: {email} exceeded max login attempts."
                )
            else:
                AuditLogRepository.create(
                    db,
                    event_type="LOGIN_FAILED_WRONG_PASSWORD",
                    user_id=user.id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=f"Login attempt failed: incorrect password for {email}."
                )
            
            try:
                UserRepository.update(db, user)
            except SQLAlchemyError:
                db.rollback()
                raise

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )

        # Check if user is active
        if not user.is_active:
            AuditLogRepository.create(
                db,
                event_type="LOGIN_FAILED_DISABLED",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Login attempt failed: account {email} is disabled."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled. Please contact support."
            )

        # Check if email is verified
        if not user.is_verified:
            AuditLogRepository.create(
                db,
                event_type="LOGIN_FAILED_UNVERIFIED",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Login attempt failed: email {email} is unverified."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address to log in."
            )

        # Reset failed attempts on success
        if user.failed_login_attempts > 0 or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            try:
                UserRepository.update(db, user)
            except SQLAlchemyError:
                db.rollback()
                raise

        AuditLogRepository.create(
            db,
            event_type="LOGIN_SUCCESS",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"User {email} logged in successfully."
        )

        return user

    @staticmethod
    def forgot_password(db: Session, email: str, ip_address: str | None = None, user_agent: str | None = None) -> bool:
        # To prevent user enumeration, always return True and a success message to the client.
        user = UserRepository.get_by_email(db, email)
        if not user:
            AuditLogRepository.create(
                db,
                event_type="FORGOT_PASSWORD_REQUEST_NONEXISTENT",
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Forgot password requested for non-existent email: {email}."
            )
            return True

        reset_token = str(uuid.uuid4())
        reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)

        user.reset_token = reset_token
        user.reset_token_expires_at = reset_token_expires_at

        try:
            UserRepository.update(db, user)
        except SQLAlchemyError:
            db.rollback()
            raise

        AuditLogRepository.create(
            db,
            event_type="FORGOT_PASSWORD_REQUEST_SUCCESS",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Forgot password reset link generated for {email}."
        )

        reset_link = f"http://127.0.0.1:8000/pages/reset-password.html?token={reset_token}"
        body = (
            f"Hello {user.first_name},\n\n"
            f"We received a request to reset your password. Please click the link below to set a new password:\n"
            f"{reset_link}\n\n"
            f"This link will expire in 1 hour."
        )
        send_simulated_email("PASSWORD_RESET", email, "Reset Your CloudCrackers Password", body)

        return True

    @staticmethod
    def reset_password(db: Session, token: str, new_password: str, ip_address: str | None = None, user_agent: str | None = None) -> bool:
        user = UserRepository.get_by_reset_token(db, token)
        if not user:
            AuditLogRepository.create(
                db,
                event_type="PASSWORD_RESET_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                details="Password reset failed: Invalid token."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token."
            )

        if user.reset_token_expires_at and user.reset_token_expires_at < datetime.utcnow():
            AuditLogRepository.create(
                db,
                event_type="PASSWORD_RESET_FAILED",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details="Password reset failed: Token expired."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token."
            )

        user.password_hash = hash_password(new_password)
        user.reset_token = None
        user.reset_token_expires_at = None

        try:
            UserRepository.update(db, user)
            # Revoke all sessions for this user on password reset (Logout All Devices)
            RefreshTokenRepository.revoke_all_for_user(db, user.id)
        except SQLAlchemyError:
            db.rollback()
            raise

        AuditLogRepository.create(
            db,
            event_type="PASSWORD_RESET_SUCCESS",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Password successfully reset for {user.email}. All active sessions revoked."
        )

        return True

    @staticmethod
    def create_refresh_token_for_user(db: Session, user_id: str, ip_address: str | None = None, user_agent: str | None = None) -> str:
        raw_token = secrets.token_hex(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.utcnow() + timedelta(days=7)

        from app.utils.user_agent import parse_user_agent
        browser_name, device_name, os_name = parse_user_agent(user_agent)

        ref_token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            browser=browser_name,
            os=os_name,
            device=device_name,
            login_time=datetime.utcnow()
        )

        try:
            RefreshTokenRepository.create(db, ref_token)
        except SQLAlchemyError:
            db.rollback()
            raise

        return raw_token

    @staticmethod
    def rotate_refresh_token(db: Session, raw_token: str, ip_address: str | None = None, user_agent: str | None = None) -> dict:
        old_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        db_token = RefreshTokenRepository.get_by_token_hash(db, old_hash)

        if not db_token:
            AuditLogRepository.create(
                db,
                event_type="TOKEN_REFRESH_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                details="Token refresh failed: Invalid token hash."
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token."
            )

        # Check for token reuse/theft
        if db_token.revoked_at is not None:
            # Token reuse detected! Revoke all tokens for the user to safeguard the account
            try:
                RefreshTokenRepository.revoke_all_for_user(db, db_token.user_id)
            except SQLAlchemyError:
                db.rollback()
                raise
            
            AuditLogRepository.create(
                db,
                event_type="TOKEN_REUSE_THEFT",
                user_id=db_token.user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                details="SUSPICIOUS: Revoked refresh token reuse detected! Terminated all active user sessions."
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Suspicious session activity detected. All user sessions have been terminated."
            )

        # Check for expiration
        if db_token.expires_at < datetime.utcnow():
            AuditLogRepository.create(
                db,
                event_type="TOKEN_REFRESH_FAILED",
                user_id=db_token.user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                details="Token refresh failed: Refresh token expired."
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token."
            )

        # Generate new tokens
        new_raw = secrets.token_hex(32)
        new_hash = hashlib.sha256(new_raw.encode()).hexdigest()
        new_expires_at = datetime.utcnow() + timedelta(days=7)

        from app.utils.user_agent import parse_user_agent
        browser_name, device_name, os_name = parse_user_agent(user_agent)

        new_ref_token = RefreshToken(
            user_id=db_token.user_id,
            token_hash=new_hash,
            expires_at=new_expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            browser=browser_name,
            os=os_name,
            device=device_name,
            login_time=datetime.utcnow()
        )

        try:
            RefreshTokenRepository.revoke(db, db_token, replaced_by_hash=new_hash)
            RefreshTokenRepository.create(db, new_ref_token)
        except SQLAlchemyError:
            db.rollback()
            raise

        user = UserRepository.get_by_id(db, db_token.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found."
            )

        new_access = create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role
            }
        )

        AuditLogRepository.create(
            db,
            event_type="TOKEN_REFRESH_SUCCESS",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details="Rotated refresh token and generated new access token."
        )

        return {
            "access_token": new_access,
            "refresh_token": new_raw
        }

    @staticmethod
    def revoke_refresh_token(db: Session, raw_token: str, ip_address: str | None = None, user_agent: str | None = None) -> None:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        db_token = RefreshTokenRepository.get_by_token_hash(db, token_hash)
        if db_token and db_token.revoked_at is None:
            try:
                RefreshTokenRepository.revoke(db, db_token)
            except SQLAlchemyError:
                db.rollback()
                raise
            
            AuditLogRepository.create(
                db,
                event_type="LOGOUT",
                user_id=db_token.user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                details="Revoked refresh token (logout)."
            )

    @staticmethod
    def logout_all_devices(db: Session, user_id: str, ip_address: str | None = None, user_agent: str | None = None) -> None:
        try:
            RefreshTokenRepository.revoke_all_for_user(db, user_id)
        except SQLAlchemyError:
            db.rollback()
            raise

        AuditLogRepository.create(
            db,
            event_type="LOGOUT_ALL",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details="Revoked all active refresh tokens (logout all devices)."
        )

    @staticmethod
    def blacklist_access_token(db: Session, jti: str, exp_timestamp: int, ip_address: str | None = None, user_agent: str | None = None) -> None:
        try:
            expires_at = datetime.utcfromtimestamp(exp_timestamp)
            RevokedTokenRepository.add(db, jti, expires_at)
            
            AuditLogRepository.create(
                db,
                event_type="JWT_BLACKLIST",
                ip_address=ip_address,
                user_agent=user_agent,
                details=f"Blacklisted access token (JTI: {jti}) until {expires_at.isoformat()}."
            )
        except Exception as e:
            logger.error(f"Failed to blacklist access token: {e}")


