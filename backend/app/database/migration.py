"""
=========================================
CloudCrackers
Database Migration Helper
=========================================
"""

import logging
from sqlalchemy import inspect, text

logger = logging.getLogger("cloudcrackers")


def upgrade_db_schema(engine):
    """
    Checks if columns exist in users, refresh_tokens, and audit_logs tables,
    and adds them if missing.
    """
    inspector = inspect(engine)

    # 1. Upgrade 'users' Table
    if inspector.has_table("users"):
        columns = [col["name"] for col in inspector.get_columns("users")]
        alterations = []

        # Standard auth modifications
        if "is_verified" not in columns:
            alterations.append("ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0")
        if "verification_token" not in columns:
            alterations.append("ADD COLUMN verification_token VARCHAR(255) NULL")
        if "verification_token_expires_at" not in columns:
            alterations.append("ADD COLUMN verification_token_expires_at DATETIME NULL")
        if "reset_token" not in columns:
            alterations.append("ADD COLUMN reset_token VARCHAR(255) NULL")
        if "reset_token_expires_at" not in columns:
            alterations.append("ADD COLUMN reset_token_expires_at DATETIME NULL")
        if "failed_login_attempts" not in columns:
            alterations.append("ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0")
        if "locked_until" not in columns:
            alterations.append("ADD COLUMN locked_until DATETIME NULL")

        # Enterprise Zoho MFA and security additions
        if "mfa_secret" not in columns:
            alterations.append("ADD COLUMN mfa_secret VARCHAR(255) NULL")
        if "mfa_enabled" not in columns:
            alterations.append("ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0")
        if "backup_codes" not in columns:
            alterations.append("ADD COLUMN backup_codes TEXT NULL")
        if "email_otp" not in columns:
            alterations.append("ADD COLUMN email_otp VARCHAR(10) NULL")
        if "email_otp_expires_at" not in columns:
            alterations.append("ADD COLUMN email_otp_expires_at DATETIME NULL")
        if "failed_mfa_attempts" not in columns:
            alterations.append("ADD COLUMN failed_mfa_attempts INT NOT NULL DEFAULT 0")
        if "last_mfa_attempt_at" not in columns:
            alterations.append("ADD COLUMN last_mfa_attempt_at DATETIME NULL")
        if "password_changed_at" not in columns:
            alterations.append("ADD COLUMN password_changed_at DATETIME NULL")
        if "trusted_browsers" not in columns:
            alterations.append("ADD COLUMN trusted_browsers TEXT NULL")

        if alterations:
            logger.info("Upgrading 'users' table schema...")
            with engine.connect() as conn:
                with conn.begin():
                    for alt in alterations:
                        stmt = f"ALTER TABLE users {alt}"
                        logger.info("Executing: %s", stmt)
                        try:
                            conn.execute(text(stmt))
                        except Exception as e:
                            logger.warning("Failed to execute '%s': %s", stmt, e)
                    
                    if "is_verified" not in columns:
                        conn.execute(text("UPDATE users SET is_verified = 1"))
            logger.info("users table schema upgrade completed.")

    # 2. Upgrade 'refresh_tokens' Table
    if inspector.has_table("refresh_tokens"):
        rt_columns = [col["name"] for col in inspector.get_columns("refresh_tokens")]
        rt_alterations = []

        if "ip_address" not in rt_columns:
            rt_alterations.append("ADD COLUMN ip_address VARCHAR(45) NULL")
        if "user_agent" not in rt_columns:
            rt_alterations.append("ADD COLUMN user_agent VARCHAR(255) NULL")

        # Zoho session and device tracking fields
        if "browser" not in rt_columns:
            rt_alterations.append("ADD COLUMN browser VARCHAR(100) NULL")
        if "os" not in rt_columns:
            rt_alterations.append("ADD COLUMN os VARCHAR(100) NULL")
        if "device" not in rt_columns:
            rt_alterations.append("ADD COLUMN device VARCHAR(100) NULL")
        if "login_time" not in rt_columns:
            rt_alterations.append("ADD COLUMN login_time DATETIME NULL")
        if "logout_time" not in rt_columns:
            rt_alterations.append("ADD COLUMN logout_time DATETIME NULL")

        if rt_alterations:
            logger.info("Upgrading 'refresh_tokens' table schema...")
            with engine.connect() as conn:
                with conn.begin():
                    for alt in rt_alterations:
                        stmt = f"ALTER TABLE refresh_tokens {alt}"
                        logger.info("Executing: %s", stmt)
                        try:
                            conn.execute(text(stmt))
                        except Exception as e:
                            logger.warning("Failed to execute '%s': %s", stmt, e)
            logger.info("refresh_tokens table schema upgrade completed.")

    # 3. Upgrade 'audit_logs' Table
    if inspector.has_table("audit_logs"):
        al_columns = [col["name"] for col in inspector.get_columns("audit_logs")]
        al_alterations = []

        if "browser" not in al_columns:
            al_alterations.append("ADD COLUMN browser VARCHAR(100) NULL")
        if "target_record" not in al_columns:
            al_alterations.append("ADD COLUMN target_record VARCHAR(255) NULL")

        if al_alterations:
            logger.info("Upgrading 'audit_logs' table schema...")
            with engine.connect() as conn:
                with conn.begin():
                    for alt in al_alterations:
                        stmt = f"ALTER TABLE audit_logs {alt}"
                        logger.info("Executing: %s", stmt)
                        try:
                            conn.execute(text(stmt))
                        except Exception as e:
                            logger.warning("Failed to execute '%s': %s", stmt, e)
            logger.info("audit_logs table schema upgrade completed.")
