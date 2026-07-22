"""
=========================================
JWT Authentication Middleware
=========================================
"""

from uuid import UUID

from fastapi import Depends
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer

from jose import JWTError

from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.utils.jwt import decode_access_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    token = credentials.credentials

    try:

        payload = decode_access_token(token)

        user_id = payload.get("sub")
        jti = payload.get("jti")

        if user_id is None or jti is None:

            raise HTTPException(
                status_code=401,
                detail="Invalid Token"
            )

        UUID(user_id)

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Token Expired or Invalid"
        )

    except ValueError:

        raise HTTPException(
            status_code=401,
            detail="Invalid Token"
        )

    from app.repositories.revoked_token_repository import RevokedTokenRepository
    if RevokedTokenRepository.is_blacklisted(db, jti):
        raise HTTPException(
            status_code=401,
            detail="Session has been revoked."
        )

    from app.repositories.user_repository import UserRepository
    user = UserRepository.get_by_id(db, user_id)

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User Not Found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account has been disabled."
        )

    return user


# Admin role validation set
ADMIN_ROLES = {"admin", "Super Admin", "Admin", "Manager", "Staff"}

ROLE_PERMISSIONS = {
    "Super Admin": {
        "Dashboard", "Products", "Categories", "Orders", "Users", "Payments", "Settings", "Reports"
    },
    "Admin": {
        "Dashboard", "Products", "Categories", "Orders", "Users", "Payments", "Settings", "Reports"
    },
    "Manager": {
        "Dashboard", "Products", "Categories", "Orders", "Reports"
    },
    "Staff": {
        "Dashboard", "Products", "Categories"
    }
}


def get_admin_user(
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Admin Access Required"
        )
    return current_user


class PermissionChecker:
    def __init__(self, permission: str):
        self.permission = permission

    def __call__(self, current_user: User = Depends(get_admin_user)) -> User:
        # Map legacy 'admin' to 'Admin' key for permission mapping lookups
        role_key = "Admin" if current_user.role == "admin" else current_user.role
        allowed = ROLE_PERMISSIONS.get(role_key, set())
        
        if self.permission not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Permission Denied: '{self.permission}' permission is required."
            )
        return current_user
