import re
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base, get_db
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.services.auth_service import SIMULATED_EMAILS_LOG
from main import app

# Setup in-memory SQLite database for test runs
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session():
    # Setup tables per test
    Base.metadata.create_all(bind=engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def fixture_client(db_session):
    # Clear rate limiters to avoid 429 errors between tests
    from app.middleware.rate_limit import auth_rate_limiter, api_rate_limiter
    auth_rate_limiter.requests.clear()
    api_rate_limiter.requests.clear()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    # Clear simulated emails log before each test
    if SIMULATED_EMAILS_LOG.exists():
        try:
            with open(SIMULATED_EMAILS_LOG, "w", encoding="utf-8") as f:
                f.truncate(0)
        except OSError:
            pass
    
    yield TestClient(app)
    app.dependency_overrides.clear()


def get_token_from_emails_log(email_type="EMAIL_VERIFICATION"):
    if not SIMULATED_EMAILS_LOG.exists():
        return None
    content = SIMULATED_EMAILS_LOG.read_text(encoding="utf-8")
    # Split content by email separator
    entries = content.split("=========================================")
    # Look from the end for the latest email matching the requested type
    for entry in reversed(entries):
        if f"TYPE: {email_type}" in entry:
            match = re.search(r"token=([a-f0-9\-]+)", entry)
            if match:
                return match.group(1)
    return None


# =====================================================================
# Registration Tests
# =====================================================================

def test_register_invalid_password(client):
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "simple"  # fails complexity rules
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert "at least 8 characters" in response.text


def test_register_weak_passwords(client):
    weak_passwords = [
        "NoSpecialChar123",
        "nospecialcharandlowercase123",
        "NO_LOWERCASE_123!",
        "no_uppercase_123!",
        "No_Digits_Special!"
    ]
    for pw in weak_passwords:
        payload = {
            "first_name": "Test",
            "last_name": "User",
            "email": "test@example.com",
            "phone": "9876543210",
            "password": pw
        }
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 422


def test_register_success(client, db_session):
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    assert "Registration successful" in response.json()["message"]

    # Verify database state
    user = db_session.query(User).filter_by(email="test@example.com").first()
    assert user is not None
    assert user.is_verified is False
    assert user.verification_token is not None
    
    # Check simulated email is logged
    token = get_token_from_emails_log("EMAIL_VERIFICATION")
    assert token == user.verification_token


# =====================================================================
# Email Verification Tests
# =====================================================================

def test_verify_email_success(client, db_session):
    # Register first
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    
    # Call verify
    response = client.get(f"/api/auth/verify-email?token={token}")
    assert response.status_code == 200
    assert "verified successfully" in response.json()["message"]

    user = db_session.query(User).filter_by(email="test@example.com").first()
    assert user.is_verified is True
    assert user.verification_token is None


def test_verify_email_invalid_token(client):
    response = client.get("/api/auth/verify-email?token=invalidtoken")
    assert response.status_code == 400
    assert "Invalid or expired verification token" in response.json()["detail"]


# =====================================================================
# Login & Lockout Tests
# =====================================================================

def test_login_unverified_user(client):
    # Register but do not verify
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    
    # Attempt login
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    assert response.status_code == 403
    assert "verify your email address" in response.json()["detail"]


def test_login_success(client):
    # Register & verify
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")

    # Login
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_lockout(client, db_session):
    # Register & verify
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")

    # Make 5 failed attempts
    for _ in range(5):
        response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "WrongPassword"})
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    # Verify lockout flag in DB
    user = db_session.query(User).filter_by(email="test@example.com").first()
    assert user.failed_login_attempts >= 5
    assert user.locked_until is not None

    # The 6th attempt (even with correct password) should fail with 403 lockout message
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    assert response.status_code == 403
    assert "temporarily locked" in response.json()["detail"]


# =====================================================================
# Token Rotation & Revocation Tests
# =====================================================================

def test_token_rotation_success(client):
    # Register, Verify & Login
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")
    login_res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"}).json()
    
    refresh_token = login_res["refresh_token"]

    # Rotate token
    rotate_res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert rotate_res.status_code == 200
    rotate_data = rotate_res.json()
    assert "access_token" in rotate_data
    assert "refresh_token" in rotate_data
    assert rotate_data["refresh_token"] != refresh_token


def test_token_rotation_theft_protection(client, db_session):
    # Register, Verify & Login
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")
    login_res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"}).json()
    
    refresh_token = login_res["refresh_token"]

    # Rotate first time (valid)
    rotate_res1 = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert rotate_res1.status_code == 200
    
    # Try to rotate a second time with the SAME (now revoked) refresh token
    rotate_res2 = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert rotate_res2.status_code == 401
    assert "Suspicious session activity detected" in rotate_res2.json()["detail"]

    # Verify that all refresh tokens for the user have been revoked
    user = db_session.query(User).filter_by(email="test@example.com").first()
    active_tokens = db_session.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None)
    ).all()
    assert len(active_tokens) == 0


def test_logout(client):
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")
    login_res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"}).json()
    
    refresh_token = login_res["refresh_token"]

    # Logout
    logout_res = client.post("/api/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 200
    
    # Try to refresh with logged out token (should fail)
    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 401


# =====================================================================
# Forgot / Reset Password Tests
# =====================================================================

def test_forgot_and_reset_password(client, db_session):
    # Register & Verify
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")

    # Forgot password
    forgot_res = client.post("/api/auth/forgot-password", json={"email": "test@example.com"})
    assert forgot_res.status_code == 200
    assert "password reset link has been sent" in forgot_res.json()["message"]

    reset_token = get_token_from_emails_log("PASSWORD_RESET")
    assert reset_token is not None

    # Reset password with weak password (should fail validation)
    reset_fail = client.post("/api/auth/reset-password", json={"token": reset_token, "password": "weak"})
    assert reset_fail.status_code == 422

    # Reset password successfully
    reset_success = client.post("/api/auth/reset-password", json={"token": reset_token, "password": "NewSecurePassword123!"})
    assert reset_success.status_code == 200
    assert "Password reset successfully" in reset_success.json()["message"]

    # Try login with old password (should fail)
    login_old = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    assert login_old.status_code == 401

    # Login with new password (should succeed)
    login_new = client.post("/api/auth/login", json={"email": "test@example.com", "password": "NewSecurePassword123!"})
    assert login_new.status_code == 200


# =====================================================================
# Advanced Security Tests
# =====================================================================

from app.models.audit_log import AuditLog
from app.models.revoked_token import RevokedToken

def test_security_headers(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert "Content-Security-Policy" in response.headers
    assert "Strict-Transport-Security" in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"


def test_request_size_limit(client):
    large_payload = "a" * (5 * 1024 * 1024 + 100) # > 5MB
    response = client.post("/api/auth/login", content=large_payload, headers={"Content-Length": str(len(large_payload))})
    assert response.status_code == 413


def test_csrf_protection(client):
    # Public endpoints like registration bypass CSRF
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    reg_res = client.post("/api/auth/register", json=payload)
    assert reg_res.status_code == 201

    # Call verify-email which is a GET route. It sets the csrf_token cookie.
    token = get_token_from_emails_log()
    verify_res = client.get(f"/api/auth/verify-email?token={token}")
    assert verify_res.status_code == 200
    assert "csrf_token" in client.cookies

    # Unsafe routes that are NOT exempt (like PUT /api/users/me) require CSRF token matching
    # First, let's call without CSRF header (should return 403 CSRF failed)
    me_res_no_csrf = client.put("/api/users/me", json={"first_name": "NewName"})
    assert me_res_no_csrf.status_code == 403
    assert "CSRF Token Validation Failed" in me_res_no_csrf.text

    # Set matching CSRF cookie and header. Now it passes CSRF (should return 401 Unauthorized instead of 403 CSRF error because we haven't authenticated)
    csrf_val = client.cookies.get("csrf_token")
    headers = {
        "x-csrf-token": csrf_val,
        "Cookie": f"csrf_token={csrf_val}",
        "Authorization": "Bearer invalid_token"
    }
    me_res_with_csrf = client.put("/api/users/me", json={"first_name": "NewName"}, headers=headers)
    assert me_res_with_csrf.status_code == 401 # Passed CSRF check!


def test_audit_logging_success(client, db_session):
    # Register & Verify
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    
    # Audit log check for registration
    reg_log = db_session.query(AuditLog).filter_by(event_type="REGISTER_SUCCESS").first()
    assert reg_log is not None
    assert "registered successfully" in reg_log.details

    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")

    # Audit log check for verify
    verify_log = db_session.query(AuditLog).filter_by(event_type="EMAIL_VERIFY_SUCCESS").first()
    assert verify_log is not None

    # Login
    client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    login_log = db_session.query(AuditLog).filter_by(event_type="LOGIN_SUCCESS").first()
    assert login_log is not None
    assert login_log.user_id is not None


def test_jwt_revocation_on_logout(client):
    # Register, Verify & Login
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    token = get_token_from_emails_log()
    client.get(f"/api/auth/verify-email?token={token}")
    login_res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"}).json()

    access_token = login_res["access_token"]
    refresh_token = login_res["refresh_token"]

    # Verify that we can access profile with the access token
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # GET /api/users/me is exempt from CSRF
    me_res = client.get("/api/users/me", headers=headers)
    assert me_res.status_code == 200

    # Call logout
    logout_res = client.post("/api/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    assert logout_res.status_code == 200

    # Now trying to access profile with the same access token should be rejected (revoked!)
    me_res_revoked = client.get("/api/users/me", headers=headers)
    assert me_res_revoked.status_code == 401
    assert "Session has been revoked" in me_res_revoked.json()["detail"]

