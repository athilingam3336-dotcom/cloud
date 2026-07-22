"""
=========================================
CloudCrackers
Password Utility (Native bcrypt)
=========================================
"""

import bcrypt


def hash_password(password: str) -> str:
    """
    Hash Plain Password using native bcrypt
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """
    Verify Plain Password against hashed password using native bcrypt
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False