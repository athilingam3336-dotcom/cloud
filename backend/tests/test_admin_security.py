import os
import uuid
import base64
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base, get_db
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.order import Order
from app.models.settings import StoreSettings
from app.utils.password import hash_password
from app.utils.jwt import create_access_token
from app.utils.file_validator import validate_and_sanitize_image, virus_scan_file
from main import app

# Setup in-memory SQLite database for testing
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
    # Perform schema migrations
    from app.database.migration import upgrade_db_schema
    upgrade_db_schema(engine)
    
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Register app dependency override
    def override_get_db():
        try:
            yield session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    
    yield session
    
    app.dependency_overrides.clear()
    session.close()
    transaction.rollback()
    connection.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="test_client")
def fixture_test_client(db_session):
    return TestClient(app)


def test_admin_login_requires_mfa(db_session, test_client):
    # 1. Register administrative user
    admin = User(
        id=str(uuid.uuid4()),
        first_name="Admin",
        last_name="User",
        email="superadmin@cloudcrackers.com",
        password_hash=hash_password("SuperSecret123!"),
        role="Super Admin",
        is_verified=True,
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()

    # 2. POST to /api/auth/login
    response = test_client.post(
        "/api/auth/login",
        json={"email": "superadmin@cloudcrackers.com", "password": "SuperSecret123!"}
    )
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["mfa_required"] is True
    assert "mfa_token" in res_data
    assert res_data["mfa_method"] == "email"


def test_mfa_verify_flow(db_session, test_client):
    admin = User(
        id=str(uuid.uuid4()),
        first_name="Admin",
        last_name="User",
        email="superadmin@cloudcrackers.com",
        password_hash=hash_password("SuperSecret123!"),
        role="Super Admin",
        is_verified=True,
        is_active=True,
        email_otp="123456",
        email_otp_expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    db_session.add(admin)
    db_session.commit()

    mfa_jwt = create_access_token({"sub": admin.id, "type": "mfa_pending"})

    # Verify with correct code
    response = test_client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": mfa_jwt, "code": "123456"}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert "access_token" in res_data
    assert "refresh_token" in res_data
    assert res_data["token_type"] == "bearer"


def test_rbac_permission_check(db_session, test_client):
    # Staff role user
    staff = User(
        id=str(uuid.uuid4()),
        first_name="Staff",
        last_name="User",
        email="staff@cloudcrackers.com",
        password_hash=hash_password("StaffPass123!"),
        role="Staff",
        is_verified=True,
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()

    token = create_access_token({"sub": staff.id, "email": staff.email, "role": staff.role})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Staff can view dashboard (has Dashboard permission)
    dashboard_res = test_client.get("/api/admin/dashboard", headers=headers)
    assert dashboard_res.status_code == 200

    # 2. Staff CANNOT access settings (Settings permission required)
    settings_res = test_client.get("/api/settings/", headers=headers)
    assert settings_res.status_code == 403
    assert "Permission Denied" in settings_res.json()["detail"]


def test_image_upload_magic_bytes_and_eicar(db_session):
    # Fake virus scan check (EICAR signature)
    assert virus_scan_file(b"normal text contents") is True
    assert virus_scan_file(b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE") is False

    # 1. Reject invalid base64 signature
    fake_png_base64 = "data:image/png;base64," + base64.b64encode(b"not a png signature").decode()
    with pytest.raises(ValueError, match="Invalid file signature"):
        validate_and_sanitize_image(fake_png_base64)

    # 2. Reject executables (MZ signature)
    executable_base64 = "data:image/png;base64," + base64.b64encode(b"MZpngdata").decode()
    with pytest.raises(ValueError, match="Dangerous file type rejected"):
        validate_and_sanitize_image(executable_base64)

    # 3. Reject EICAR virus payloads
    virus_payload = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"
    # Prefix it with PNG magic bytes signature to trick parser
    tricked_payload = b"\x89PNG\r\n\x1a\n" + virus_payload
    tricked_base64 = "data:image/png;base64," + base64.b64encode(tricked_payload).decode()
    with pytest.raises(ValueError, match="Virus signature detected"):
        validate_and_sanitize_image(tricked_base64)


def test_path_traversal_prevention(db_session, test_client):
    # Retrieve file name with dot-dot-slash segments
    response = test_client.get("/api/products/images/../../etc/passwd")
    # Due to routing / path parameters matching, path traversal results in 404
    assert response.status_code == 404


def test_store_wiping_mfa(db_session, test_client):
    admin = User(
        id=str(uuid.uuid4()),
        first_name="Super",
        last_name="Admin",
        email="superadmin@cloudcrackers.com",
        password_hash=hash_password("SuperSecret123!"),
        role="Super Admin",
        is_verified=True,
        is_active=True,
        mfa_enabled=True,
        mfa_secret="JBSWY3DPEHPK3PXP" # Base32 secret for TOTP confirmation tests
    )
    db_session.add(admin)

    # Add dummy products/categories
    cat = Category(id=str(uuid.uuid4()), category_name="Crackers")
    db_session.add(cat)
    db_session.commit()

    prod = Product(
        id=str(uuid.uuid4()),
        category_id=cat.id,
        product_name="Golden Sparkler",
        price=150.0,
        stock_quantity=10
    )
    db_session.add(prod)
    db_session.commit()

    # Generate Admin token
    token = create_access_token({"sub": admin.id, "email": admin.email, "role": admin.role})
    cookies = {"csrf_token": "test_csrf_secret"}
    headers = {
        "Authorization": f"Bearer {token}",
        "X-CSRF-Token": "test_csrf_secret"
    }

    # Verify that updating settings with deleteStore fails without password confirmation
    wipe_payload = {
        "storeName": "Cleared Store",
        "contactEmail": "cleared@store.com",
        "taxRate": 18.0,
        "shippingCharge": 80,
        "currency": "INR",
        "maintenanceMode": "OFF",
        "deleteStore": True
    }
    fail_res = test_client.put("/api/settings/", json=wipe_payload, headers=headers, cookies=cookies)
    assert fail_res.status_code == 400
    assert "password" in fail_res.json()["detail"].lower()
