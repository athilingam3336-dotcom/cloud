"""
=========================================
CloudCrackers
Product APIs
=========================================
"""

import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.auth import PermissionChecker
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductImageResponse,
    ProductImageUploadSchema
)
from app.services.product_service import ProductService
from app.repositories.audit_log_repository import AuditLogRepository

router = APIRouter()


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED
)
def create_product(
    data: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    # Validate category exists
    category = db.query(Category).filter(Category.id == str(data.category_id)).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category Not Found"
        )

    # Validate duplicate name
    dup = db.query(Product).filter(Product.product_name == data.product_name).first()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name already exists."
        )

    # Save base64 image securely if present
    if data.product_image and data.product_image.startswith("data:image/"):
        from app.utils.file_validator import save_secure_file
        try:
            filename = save_secure_file(data.product_image)
            data.product_image = f"/api/products/images/{filename}"
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

    product = ProductService.create_product(db, data)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_CREATED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Product '{product.product_name}' created.",
        target_record=str(product.id)
    )

    return product


@router.get("/", response_model=list[ProductResponse])
def get_products(
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    db: Session = Depends(get_db)
):
    return ProductService.get_all_products(
        db,
        category,
        min_price,
        max_price
    )


@router.get("/search", response_model=list[ProductResponse])
def search_products(
    q: str,
    db: Session = Depends(get_db)
):
    return ProductService.search_products(
        db,
        q
    )


@router.get("/images/{filename}")
def get_product_image(filename: str):
    # Path traversal prevention: enforce filename base extract
    clean_filename = os.path.basename(filename)
    path = os.path.join("uploads", clean_filename)
    if not os.path.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found."
        )

    ext = clean_filename.split(".")[-1].lower()
    media_type = f"image/{ext}"
    if ext in {"jpg", "jpeg"}:
        media_type = "image/jpeg"

    return FileResponse(path, media_type=media_type)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product_by_id(
        db,
        product_id
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    data: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    # Validate category exists if updated
    if data.category_id:
        category = db.query(Category).filter(Category.id == str(data.category_id)).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category Not Found"
            )

    # Validate duplicate name
    if data.product_name:
        dup = db.query(Product).filter(
            Product.product_name == data.product_name,
            Product.id != product_id
        ).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another product with this name already exists."
            )

    # Save base64 image securely if updated
    if data.product_image and data.product_image.startswith("data:image/"):
        from app.utils.file_validator import save_secure_file
        try:
            filename = save_secure_file(data.product_image)
            data.product_image = f"/api/products/images/{filename}"
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

    updated = ProductService.update_product(
        db,
        product_id,
        data
    )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_UPDATED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Product '{updated.product_name}' updated.",
        target_record=str(updated.id)
    )

    return updated


@router.delete("/{product_id}")
def delete_product(
    product_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    ProductService.delete_product(
        db,
        product_id
    )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_DELETED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Product '{product.product_name}' deleted.",
        target_record=product_id
    )

    return {
        "message": "Product Deleted Successfully"
    }


# ==========================================
# Product Image Management Endpoints
# ==========================================

@router.get("/{product_id}/images", response_model=list[ProductImageResponse])
def get_product_images(
    product_id: str,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )
    return product.images


@router.post(
    "/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED
)
def upload_product_image(
    product_id: str,
    data: ProductImageUploadSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    from app.utils.file_validator import save_secure_file
    try:
        filename = save_secure_file(data.image_data)
        image_url = f"/api/products/images/{filename}"
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Check if this is the first image or marked as primary
    existing_images = product.images
    is_primary = data.is_primary or len(existing_images) == 0

    if is_primary:
        # Reset all other images to is_primary=False
        for img in existing_images:
            img.is_primary = False
        # Update product fallback thumbnail
        product.product_image = image_url

    from app.models.product_image import ProductImage
    new_img = ProductImage(
        product_id=product_id,
        image_url=image_url,
        is_primary=is_primary
    )
    db.add(new_img)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_IMAGE_UPLOADED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Uploaded image '{image_url}' for product '{product.product_name}'",
        target_record=str(product.id)
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database save failed: {str(e)}"
        )

    db.refresh(new_img)
    return new_img


@router.put("/{product_id}/images/{image_id}/primary", response_model=ProductImageResponse)
def set_primary_image(
    product_id: str,
    image_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    from app.models.product_image import ProductImage
    target_image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    if not target_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image Not Found"
        )

    for img in product.images:
        img.is_primary = (img.id == image_id)

    product.product_image = target_image.image_url

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_IMAGE_SET_PRIMARY",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Set primary image '{target_image.image_url}' for product '{product.product_name}'",
        target_record=str(product.id)
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}"
        )

    db.refresh(target_image)
    return target_image


@router.put("/{product_id}/images/{image_id}", response_model=ProductImageResponse)
def replace_product_image(
    product_id: str,
    image_id: str,
    data: ProductImageUploadSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    from app.models.product_image import ProductImage
    target_image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    if not target_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image Not Found"
        )

    # Delete old physical file if it starts with '/api/products/images/'
    if target_image.image_url.startswith("/api/products/images/"):
        old_filename = os.path.basename(target_image.image_url)
        old_file_path = os.path.join("uploads", old_filename)
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except Exception:
                pass

    # Save new physical file
    from app.utils.file_validator import save_secure_file
    try:
        filename = save_secure_file(data.image_data)
        image_url = f"/api/products/images/{filename}"
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    target_image.image_url = image_url

    if target_image.is_primary:
        product.product_image = image_url

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_IMAGE_REPLACED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Replaced image with '{image_url}' for product '{product.product_name}'",
        target_record=str(product.id)
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}"
        )

    db.refresh(target_image)
    return target_image


@router.delete("/{product_id}/images/{image_id}")
def delete_product_image(
    product_id: str,
    image_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("Products"))
):
    product = ProductService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product Not Found"
        )

    from app.models.product_image import ProductImage
    target_image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    if not target_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image Not Found"
        )

    # Delete physical file
    if target_image.image_url.startswith("/api/products/images/"):
        filename = os.path.basename(target_image.image_url)
        file_path = os.path.join("uploads", filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

    was_primary = target_image.is_primary
    db.delete(target_image)
    db.flush()

    # If deleted image was primary, set another image as primary if any exist
    remaining_images = [img for img in product.images if img.id != image_id]
    if was_primary and len(remaining_images) > 0:
        remaining_images[0].is_primary = True
        product.product_image = remaining_images[0].image_url
    elif len(remaining_images) == 0:
        product.product_image = None

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    AuditLogRepository.create(
        db,
        event_type="PRODUCT_IMAGE_DELETED",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
        details=f"Deleted image '{target_image.image_url}' for product '{product.product_name}'",
        target_record=str(product.id)
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database delete failed: {str(e)}"
        )

    return {
        "message": "Image Deleted Successfully"
    }
