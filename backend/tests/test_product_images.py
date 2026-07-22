import os
import uuid
import base64
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base, get_db
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.utils.password import hash_password
from app.utils.jwt import create_access_token
from main import app

# Setup SQLite database for testing
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
    from app.database.migration import upgrade_db_schema
    upgrade_db_schema(engine)
    
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
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
    client = TestClient(app)
    # Set the CSRF token cookie on the client instance so it is sent automatically
    client.cookies.set("csrf_token", "test_csrf_secret")
    return client


@pytest.fixture(name="admin_headers")
def fixture_admin_headers(db_session):
    admin = User(
        id=str(uuid.uuid4()),
        first_name="Admin",
        last_name="User",
        email="admin@cloudcrackers.com",
        password_hash=hash_password("SuperSecret123!"),
        role="Admin",
        is_verified=True,
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()
    
    token = create_access_token({"sub": admin.id, "email": admin.email, "role": admin.role})
    return {
        "Authorization": f"Bearer {token}",
        "X-CSRF-Token": "test_csrf_secret"
    }


@pytest.fixture(name="test_product")
def fixture_test_product(db_session):
    category = Category(
        id=str(uuid.uuid4()),
        category_name="Sparklers",
        status="ACTIVE"
    )
    db_session.add(category)
    db_session.commit()
    
    product = Product(
        id=str(uuid.uuid4()),
        category_id=category.id,
        product_name="Golden Sparkler",
        price=100.0,
        stock_quantity=50,
        status="ACTIVE",
        sku="SKU-GOLD-SPK"
    )
    db_session.add(product)
    db_session.commit()
    return product


def test_get_product_images_empty(test_client, test_product):
    response = test_client.get(f"/api/products/{test_product.id}/images")
    assert response.status_code == 200
    assert response.json() == []


def test_upload_product_images_size_and_validation(test_client, test_product, admin_headers):
    # 1. Upload valid PNG image (magic signature: 89 50 4E 47 0D 0A 1A 0A)
    png_data = b"\x89PNG\r\n\x1a\n" + b"some fake image content padding"
    base64_payload = "data:image/png;base64," + base64.b64encode(png_data).decode()
    
    response = test_client.post(
        f"/api/products/{test_product.id}/images",
        headers=admin_headers,
        json={"image_data": base64_payload, "is_primary": True}
    )
    assert response.status_code == 201
    res_data = response.json()
    assert "image_url" in res_data
    assert res_data["is_primary"] is True
    
    # 2. Upload invalid image signature (should fail)
    bad_payload = "data:image/png;base64," + base64.b64encode(b"invalid header").decode()
    response = test_client.post(
        f"/api/products/{test_product.id}/images",
        headers=admin_headers,
        json={"image_data": bad_payload}
    )
    assert response.status_code == 400
    assert "Invalid file signature" in response.json()["detail"]

    # 3. Upload image exceeding 5MB limit
    oversized_data = b"\x89PNG\r\n\x1a\n" + b"x" * (6 * 1024 * 1024) # 6MB
    oversized_payload = "data:image/png;base64," + base64.b64encode(oversized_data).decode()
    response = test_client.post(
        f"/api/products/{test_product.id}/images",
        headers=admin_headers,
        json={"image_data": oversized_payload}
    )
    assert response.status_code in (400, 413)


def test_set_primary_and_replace_and_delete_flow(test_client, test_product, admin_headers, db_session):
    # Clear upload directory files created by tests later if necessary
    created_filenames = []
    
    # 1. Upload two images
    img1_bytes = b"\x89PNG\r\n\x1a\n" + b"image 1 content"
    img1_b64 = "data:image/png;base64," + base64.b64encode(img1_bytes).decode()
    
    res1 = test_client.post(
        f"/api/products/{test_product.id}/images",
        headers=admin_headers,
        json={"image_data": img1_b64, "is_primary": True}
    )
    assert res1.status_code == 201
    img1 = res1.json()
    created_filenames.append(img1["image_url"].split("/")[-1])
    
    img2_bytes = b"\xff\xd8\xff" + b"image 2 content"
    img2_b64 = "data:image/jpeg;base64," + base64.b64encode(img2_bytes).decode()
    
    res2 = test_client.post(
        f"/api/products/{test_product.id}/images",
        headers=admin_headers,
        json={"image_data": img2_b64, "is_primary": False}
    )
    assert res2.status_code == 201
    img2 = res2.json()
    created_filenames.append(img2["image_url"].split("/")[-1])

    # Get images list
    list_res = test_client.get(f"/api/products/{test_product.id}/images")
    assert len(list_res.json()) == 2

    # Verify first image is primary
    assert list_res.json()[0]["is_primary"] is True
    assert list_res.json()[1]["is_primary"] is False

    # 2. Change primary to second image
    primary_res = test_client.put(
        f"/api/products/{test_product.id}/images/{img2['id']}/primary",
        headers=admin_headers
    )
    assert primary_res.status_code == 200
    
    # Re-fetch images to verify updates
    list_res = test_client.get(f"/api/products/{test_product.id}/images")
    images = list_res.json()
    assert images[0]["is_primary"] is False
    assert images[1]["is_primary"] is True

    # Check that product table's fallback image updated to image 2 URL
    product_res = test_client.get(f"/api/products/{test_product.id}")
    assert product_res.json()["product_image"] == img2["image_url"]

    # 3. Replace image 1 with new JPEG data
    new_jpg_bytes = b"\xff\xd8\xff" + b"replaced image content"
    new_jpg_b64 = "data:image/jpeg;base64," + base64.b64encode(new_jpg_bytes).decode()
    
    replace_res = test_client.put(
        f"/api/products/{test_product.id}/images/{img1['id']}",
        headers=admin_headers,
        json={"image_data": new_jpg_b64}
    )
    assert replace_res.status_code == 200
    replaced_img = replace_res.json()
    created_filenames.append(replaced_img["image_url"].split("/")[-1])
    assert replaced_img["image_url"] != img1["image_url"]

    # 4. Delete image 2 (which is current primary)
    delete_res = test_client.delete(
        f"/api/products/{test_product.id}/images/{img2['id']}",
        headers=admin_headers
    )
    assert delete_res.status_code == 200
    
    # Re-fetch images - only 1 remaining, and it should automatically become primary
    list_res = test_client.get(f"/api/products/{test_product.id}/images")
    remaining = list_res.json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == img1["id"]
    assert remaining[0]["is_primary"] is True

    # Re-fetch product to verify fallback image updated to replaced image 1
    product_res = test_client.get(f"/api/products/{test_product.id}")
    assert product_res.json()["product_image"] == remaining[0]["image_url"]

    # Clean up physical files in uploads directory created during test
    for filename in created_filenames:
        filepath = os.path.join("uploads", filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
