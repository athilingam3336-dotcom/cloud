"""
=========================================
CloudCrackers
database.py
Database Connection
=========================================
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


# ==========================================
# Database Engine
# ==========================================

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_recycle=3600,
    future=True
)


# ==========================================
# Database Session
# ==========================================

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)


# ==========================================
# Base Class
# ==========================================

Base = declarative_base()


# ==========================================
# Dependency
# ==========================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()
