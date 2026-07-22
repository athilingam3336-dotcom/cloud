"""
=========================================
CloudCrackers API
Main Application
=========================================
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database.database import Base, engine
from app.database.migration import upgrade_db_schema
from app.middleware.security import (
    SecurityHeadersMiddleware,
    RequestSizeLimitMiddleware,
    CSRFMiddleware
)
from app.core.config import settings

# Registers every model on Base.metadata (see app/database/base.py) so that
# create_all below builds ALL tables, not just whichever ones happen to be
# imported here.
import app.database.base  # noqa: F401

# Perform database upgrades if tables already exist
upgrade_db_schema(engine)

Base.metadata.create_all(bind=engine)

# =========================================
# API Routers
# =========================================

from app.api.auth import router as auth_router
from app.api.categories import router as category_router
from app.api.products import router as product_router
from app.api.cart import router as cart_router
from app.api.wishlist import router as wishlist_router
from app.api.orders import router as order_router
from app.api.payments import router as payment_router
from app.api.users import router as user_router
from app.api.admin import router as admin_router
from app.api.settings import router as settings_router
from app.api.spin import router as spin_router


# =========================================
# Logging
# =========================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudcrackers")

# =========================================
# FastAPI App
# =========================================

app = FastAPI(
    title="CloudCrackers API",
    description="CloudCrackers E-Commerce Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# =========================================
# Security Middlewares Configuration
# =========================================

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(CSRFMiddleware)

# =========================================
# CORS Configuration
# =========================================

origins = [o.strip() for o in settings.ALLOWED_CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================
# Global Exception Handler
# =========================================

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):

    logger.exception(
        "Unhandled error on %s %s", request.method, request.url.path
    )

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Something went wrong on our end. Please try again later."
            }
        }
    )


# =========================================
# Home Route
# =========================================

@app.get("/")
async def root():
    return {
        "message": "Welcome to CloudCrackers API",
        "status": "Running"
    }


# =========================================
# Health Check
# =========================================

@app.get("/health")
async def health():
    return {
        "status": "Healthy"
    }


# =========================================
# API Routers
# =========================================

app.include_router(
    auth_router,
    prefix="/api/auth",
    tags=["Authentication"]
)

app.include_router(
    category_router,
    prefix="/api/categories",
    tags=["Categories"]
)

app.include_router(
    product_router,
    prefix="/api/products",
    tags=["Products"]
)

app.include_router(
    cart_router,
    prefix="/api/cart",
    tags=["Cart"]
)

app.include_router(
    wishlist_router,
    prefix="/api/wishlist",
    tags=["Wishlist"]
)

app.include_router(
    order_router,
    prefix="/api/orders",
    tags=["Orders"]
)

app.include_router(
    payment_router,
    prefix="/api/payments",
    tags=["Payments"]
)

app.include_router(
    user_router,
    prefix="/api/users",
    tags=["Users"]
)

app.include_router(
    admin_router,
    prefix="/api/admin",
    tags=["Admin"]
)

app.include_router(
    settings_router,
    prefix="/api/settings",
    tags=["Settings"]
)

app.include_router(
    spin_router,
    prefix="/api/spin",
    tags=["Spin"]
)