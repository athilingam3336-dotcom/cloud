import re
import uuid
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from pydantic import ValidationError

from app.database.database import Base, get_db
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog
from app.models.revoked_token import RevokedToken

from app.utils.password import hash_password, verify_password
from app.utils.jwt import create_access_token, decode_access_token
from app.utils.xss import sanitize_text
from app.schemas.auth import RegisterRequest, validate_password_strength
from app.services.auth_service import SIMULATED_EMAILS_LOG, AuthService
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
    entries = content.split("=========================================")
    for entry in reversed(entries):
        if f"TYPE: {email_type}" in entry:
            match = re.search(r"token=([a-f0-9\-]+)", entry)
            if match:
                return match.group(1)
    return None


# =====================================================================
# 1. UNIT TESTS
# =====================================================================

def test_unit_password_hashing():
    raw_password = "SecurePassword123!"
    h_pass = hash_password(raw_password)
    assert h_pass != raw_password
    assert verify_password(raw_password, h_pass) is True
    assert verify_password("WrongPassword123!", h_pass) is False


def test_unit_jwt_encoding_decoding():
    data = {"sub": "12345", "role": "user"}
    token = create_access_token(data)
    assert token is not None
    
    decoded = decode_access_token(token)
    assert decoded["sub"] == "12345"
    assert decoded["role"] == "user"
    assert "jti" in decoded
    assert "exp" in decoded


def test_unit_xss_sanitization():
    unsafe_text = "<script>alert('xss')</script>Hello & welcome!"
    safe_text = sanitize_text(unsafe_text)
    assert "<script>" not in safe_text
    assert "</script>" not in safe_text


def test_unit_password_strength_validator():
    # Passwords failing complexity checks directly
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_strength("Short1!")
    
    with pytest.raises(ValueError, match="uppercase letter"):
        validate_password_strength("nouppercase123!")

    with pytest.raises(ValueError, match="lowercase letter"):
        validate_password_strength("NOLOWERCASE123!")

    with pytest.raises(ValueError, match="number"):
        validate_password_strength("NoNumbersHere!")

    with pytest.raises(ValueError, match="special character"):
        validate_password_strength("NoSpecialChars123")

    # Valid password
    assert validate_password_strength("ValidPassword123!") == "ValidPassword123!"


# =====================================================================
# 2. VALIDATION & SCHEMA TESTS
# =====================================================================

def test_validation_register_request_pydantic():
    # Invalid Email structure
    with pytest.raises(ValidationError):
        RegisterRequest(
            first_name="Test",
            last_name="User",
            email="invalid-email-format",
            phone="1234567890",
            password="Password123!"
        )

    # Missing first_name length boundary
    with pytest.raises(ValidationError):
        RegisterRequest(
            first_name="T",  # min_length is 2
            last_name="User",
            email="test@example.com",
            phone="1234567890",
            password="Password123!"
        )


# =====================================================================
# 3. API & EDGE CASES
# =====================================================================

def test_edge_case_empty_registration_payload(client):
    response = client.post("/api/auth/register", json={})
    assert response.status_code == 422


def test_edge_case_verify_email_empty_token(client):
    response = client.get("/api/auth/verify-email?token=")
    assert response.status_code == 400


def test_edge_case_refresh_token_empty_payload(client):
    response = client.post("/api/auth/refresh", json={})
    assert response.status_code == 422


def test_edge_case_inactive_user_login(client, db_session):
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

    # Set user active status to False in DB
    user = db_session.query(User).filter_by(email="test@example.com").first()
    user.is_active = False
    db_session.commit()

    # Attempt login
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    assert response.status_code == 403
    assert "disabled" in response.json()["detail"]


def test_edge_case_expired_verification_token(client, db_session):
    # Register
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    
    # Backdate verification expiration manually in the DB
    user = db_session.query(User).filter_by(email="test@example.com").first()
    user.verification_token_expires_at = datetime.utcnow() - timedelta(seconds=10)
    db_session.commit()

    # Attempt verification
    response = client.get(f"/api/auth/verify-email?token={user.verification_token}")
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


def test_edge_case_expired_reset_password_token(client, db_session):
    # Register & verify & forgot
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
    
    client.post("/api/auth/forgot-password", json={"email": "test@example.com"})
    reset_token = get_token_from_emails_log("PASSWORD_RESET")

    # Backdate reset token expiration manually in DB
    user = db_session.query(User).filter_by(email="test@example.com").first()
    user.reset_token_expires_at = datetime.utcnow() - timedelta(seconds=10)
    db_session.commit()

    # Attempt reset
    response = client.post("/api/auth/reset-password", json={"token": reset_token, "password": "NewPassword123!"})
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


# =====================================================================
# 4. SECURITY & ATTACK MITIGATION TESTS
# =====================================================================

def test_security_sql_injection_safety(client, db_session):
    # Attempt SQL injection inside first_name registration parameter
    payload = {
        "first_name": "injected' OR '1'='1",
        "last_name": "User",
        "email": "valid-email@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201

    # Verify SQL syntax was treated as a literal string value by SQLAlchemy
    user = db_session.query(User).filter_by(email="valid-email@example.com").first()
    assert user is not None
    assert user.first_name == "injected&#x27; OR &#x27;1&#x27;=&#x27;1"


def test_security_brute_force_lockout_auditing(client, db_session):
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

    # Trigger brute force lockout (5 failed attempts)
    for _ in range(5):
        client.post("/api/auth/login", json={"email": "test@example.com", "password": "WrongPassword"})

    # Check that the LOCKOUT audit log was successfully saved in the DB
    lock_log = db_session.query(AuditLog).filter_by(event_type="LOCKOUT").first()
    assert lock_log is not None
    assert lock_log.user_id is not None
    assert "exceeded max login attempts" in lock_log.details


def test_security_double_submit_csrf_enforcement(client):
    # Call an unsafe PUT request without CSRF cookies/headers -> 403 Forbidden
    response = client.put("/api/users/me", json={"first_name": "NoCsrf"})
    assert response.status_code == 403
    assert "CSRF Token" in response.text


def test_security_session_revocation_blacklist(client):
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

    # Access is valid initially
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = client.get("/api/users/me", headers=headers)
    assert me_res.status_code == 200

    # Logout to revoke access token
    client.post("/api/auth/logout", json={"refresh_token": refresh_token}, headers=headers)

    # Verification checks that access token is now blacklisted/revoked
    rev_res = client.get("/api/users/me", headers=headers)
    assert rev_res.status_code == 401
    assert "Session has been revoked" in rev_res.json()["detail"]
