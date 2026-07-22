"""
=========================================
CloudCrackers
Audit Log Repository
=========================================
"""

from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.utils.user_agent import parse_user_agent


class AuditLogRepository:

    @staticmethod
    def create(
        db: Session,
        event_type: str,
        user_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        details: str | None = None,
        target_record: str | None = None
    ) -> AuditLog:
        browser_name, _, _ = parse_user_agent(user_agent)
        
        log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=user_agent,
            browser=browser_name,
            target_record=target_record,
            details=details
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
