"""
=========================================
Authentication APIs
=========================================
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    TokenRefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
    MfaVerifyRequest
)
from app.services.auth_service import AuthService, SIMULATED_EMAILS_LOG
from app.utils.jwt import create_access_token, decode_access_token
from app.middleware.rate_limit import auth_rate_limiter
from app.middleware.auth import get_current_user, get_admin_user
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.utils.password import hash_password, verify_password

router = APIRouter()


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limiter)]
)
def register(
    data: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    
    AuthService.register(db, data, ip_address=ip, user_agent=ua)
    
    return {
        "message": "Registration successful. Please check your email to verify your account."
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(auth_rate_limiter)]
)
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    user = AuthService.authenticate(db, data.email, data.password, ip_address=ip, user_agent=ua)

    # Check if user role is administrative (Super Admin, Admin, Manager, Staff, orlegacy admin)
    admin_roles = {"admin", "Super Admin", "Admin", "Manager", "Staff"}
    if user.role in admin_roles:
        # Generate random 6-digit email OTP
        otp = "".join(secrets.choice("0123456789") for _ in range(6))
        user.email_otp = otp
        user.email_otp_expires_at = datetime.utcnow() + timedelta(minutes=5)
        user.failed_mfa_attempts = 0
        db.commit()

        # Log simulated OTP email
        try:
            with open(SIMULATED_EMAILS_LOG, "a", encoding="utf-8") as f:
                f.write("=========================================\n")
                f.write("TYPE: EMAIL_OTP\n")
                f.write(f"TO: {user.email}\n")
                f.write(f"OTP: {otp}\n")
                f.write(f"TIMESTAMP: {datetime.utcnow().isoformat()}\n")
                f.write("=========================================\n")
        except OSError:
            pass

        # Generate temporary mfa pending token (10-minute lifetime claim)
        mfa_pending_jwt = create_access_token(
            {
                "sub": str(user.id),
                "type": "mfa_pending"
            },
            expires_delta=timedelta(minutes=10)
        )

        AuditLogRepository.create(
            db,
            event_type="MFA_REQUIRED",
            user_id=user.id,
            ip_address=ip,
            user_agent=ua,
            details=f"Admin login success for {user.email}. Dispatched MFA Email OTP challenge."
        )

        return TokenResponse(
            mfa_required=True,
            mfa_token=mfa_pending_jwt,
            mfa_method="email"
        )

    # Normal customer login
    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )
    refresh_token = AuthService.create_refresh_token_for_user(db, user.id, ip_address=ip, user_agent=ua)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post(
    "/mfa/verify",
    response_model=TokenResponse,
    dependencies=[Depends(auth_rate_limiter)]
)
def mfa_verify(
    data: MfaVerifyRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    # 1. Parse and decode MFA pending context token
    try:
        payload = decode_access_token(data.mfa_token)
        user_id = payload.get("sub")
        claim_type = payload.get("type")
        if not user_id or claim_type != "mfa_pending":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA verification context."
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA verification context has expired."
        )

    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Brute-force lockout logic for MFA attempts
    if user.failed_mfa_attempts >= 5:
        # Lockout MFA for 15 minutes
        lock_until = user.last_mfa_attempt_at + timedelta(minutes=15) if user.last_mfa_attempt_at else datetime.utcnow()
        if lock_until > datetime.utcnow():
            AuditLogRepository.create(
                db,
                event_type="MFA_LOCKOUT",
                user_id=user.id,
                ip_address=ip,
                user_agent=ua,
                details="MFA verification locked out due to multiple failed attempts."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA entry is temporarily locked. Try again in 15 minutes."
            )

    code_valid = False
    now = datetime.utcnow()

    # Check 1: Email OTP
    if user.email_otp and user.email_otp_expires_at and user.email_otp_expires_at > now:
        if user.email_otp == data.code:
            code_valid = True
            user.email_otp = None
            user.email_otp_expires_at = None

    # Check 2: TOTP secret code
    if not code_valid and user.mfa_secret:
        from app.utils.totp import verify_totp
        if verify_totp(user.mfa_secret, data.code):
            code_valid = True

    # Check 3: Backup Code values
    if not code_valid and user.backup_codes:
        hashes = [h.strip() for h in user.backup_codes.split(",") if h.strip()]
        for h in hashes:
            # Code is matched against hashed backup codes via bcrypt verify
            if len(data.code) == 8 and verify_password(data.code, h):
                code_valid = True
                hashes.remove(h)
                user.backup_codes = ",".join(hashes) if hashes else None
                break

    user.last_mfa_attempt_at = now
    if not code_valid:
        user.failed_mfa_attempts += 1
        db.commit()

        AuditLogRepository.create(
            db,
            event_type="MFA_VERIFICATION_FAILED",
            user_id=user.id,
            ip_address=ip,
            user_agent=ua,
            details=f"Failed MFA attempt for {user.email} (Attempt {user.failed_mfa_attempts}/5)."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code."
        )

    # Success: clear temporary counters and issue real session
    user.failed_mfa_attempts = 0
    db.commit()

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )
    refresh_token = AuthService.create_refresh_token_for_user(db, user.id, ip_address=ip, user_agent=ua)

    AuditLogRepository.create(
        db,
        event_type="ADMIN_LOGIN_SUCCESS",
        user_id=user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Admin {user.email} logged in successfully."
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post("/mfa/setup")
def mfa_setup(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Returns standard Base32 Secret Key for TOTP setup.
    """
    import base64
    # Generate 160-bit key (20 random bytes)
    secret_bytes = secrets.token_bytes(20)
    secret_b32 = base64.b32encode(secret_bytes).decode().replace("=", "")

    # We store it temporarily in user session or secret container,
    # but to let them confirm, we return the secret first
    return {
        "secret": secret_b32,
        "issuer": "CloudCrackers",
        "qr_uri": f"otpauth://totp/CloudCrackers:{current_user.email}?secret={secret_b32}&issuer=CloudCrackers"
    }


@router.post("/mfa/confirm")
def mfa_confirm(
    data: dict,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    secret = data.get("secret")
    code = data.get("code")
    if not secret or not code:
        raise HTTPException(status_code=400, detail="Secret and Code are required.")

    from app.utils.totp import verify_totp
    if not verify_totp(secret, code):
        raise HTTPException(status_code=400, detail="Invalid verification code. Setup rejected.")

    # Enable TOTP on User
    current_user.mfa_secret = secret
    current_user.mfa_enabled = True

    # Generate 10 Backup Codes
    backup_list = []
    hashed_list = []
    for _ in range(10):
        # Generate 8 character alpha-numeric code
        code_str = secrets.token_hex(4)
        backup_list.append(code_str)
        hashed_list.append(hash_password(code_str))

    current_user.backup_codes = ",".join(hashed_list)
    db.commit()

    return {
        "message": "MFA configured successfully.",
        "backup_codes": backup_list
    }


@router.post(
    "/refresh",
    response_model=TokenResponse,
    dependencies=[Depends(auth_rate_limiter)]
)
def refresh(
    data: TokenRefreshRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    res = AuthService.rotate_refresh_token(db, data.refresh_token, ip_address=ip, user_agent=ua)
    return {
        "access_token": res["access_token"],
        "refresh_token": res["refresh_token"],
        "token_type": "bearer"
    }


@router.post(
    "/logout",
    response_model=MessageResponse
)
def logout(
    data: TokenRefreshRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    
    AuthService.revoke_refresh_token(db, data.refresh_token, ip_address=ip, user_agent=ua)
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                AuthService.blacklist_access_token(db, jti, exp, ip_address=ip, user_agent=ua)
        except Exception:
            pass

    return {
        "message": "Logged out successfully"
    }


@router.post(
    "/logout-all",
    response_model=MessageResponse
)
def logout_all(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    
    AuthService.logout_all_devices(db, current_user.id, ip_address=ip, user_agent=ua)
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                AuthService.blacklist_access_token(db, jti, exp, ip_address=ip, user_agent=ua)
        except Exception:
            pass

    return {
        "message": "Logged out of all devices successfully"
    }


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(auth_rate_limiter)]
)
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuthService.forgot_password(db, data.email, ip_address=ip, user_agent=ua)
    return {
        "message": "If the email is registered, a password reset link has been sent."
    }


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    dependencies=[Depends(auth_rate_limiter)]
)
def reset_password(
    data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuthService.reset_password(db, data.token, data.password, ip_address=ip, user_agent=ua)
    return {
        "message": "Password reset successfully"
    }


@router.get(
    "/verify-email",
    response_model=MessageResponse,
    dependencies=[Depends(auth_rate_limiter)]
)
def verify_email(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuthService.verify_email(db, token, ip_address=ip, user_agent=ua)
    return {
        "message": "Email verified successfully"
    }
