"""
=========================================
CloudCrackers
config.py
Application Configuration
=========================================
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):

    # =========================================
    # Database
    # =========================================

    DATABASE_URL: str

    # =========================================
    # JWT
    # =========================================

    SECRET_KEY: str

    ALGORITHM: str

    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # =========================================
    # Razorpay
    # =========================================

    RAZORPAY_KEY_ID: str

    RAZORPAY_KEY_SECRET: str

    # =========================================
    # Application
    # =========================================

    APP_NAME: str

    DEBUG: bool

    ALLOWED_CORS_ORIGINS: str = "http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5000,http://localhost:5000,http://127.0.0.1:5500,http://localhost:5500,http://172.27.91.212:5500"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings
    ):
        return (
            init_settings,
            dotenv_settings,
            env_settings,
            file_secret_settings
        )


settings = Settings()
