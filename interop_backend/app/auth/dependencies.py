import json
import datetime
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.jwt_handler import decode_access_token
from app.models.user import User
from app.models.consent import UserConsent

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    email: str = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"status": "UNAUTHORIZED", "message": "Invalid token payload"}
        )
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"status": "UNAUTHORIZED", "message": "User not found or inactive"}
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "GOVT_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"status": "FORBIDDEN", "message": "Administrative privileges required"}
        )
    return current_user


def require_applicant_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["APPLICANT", "GOVT_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"status": "FORBIDDEN", "message": "Applicant or Administrator privileges required"}
        )
    return current_user


def check_consent_for_departments(
    db: Session,
    user: User,
    required_departments: List[str]
) -> UserConsent:
    """Verifies that active, unexpired consent exists for all required departments."""
    # Use naive UTC to match SQLite's stored naive datetimes
    now = datetime.datetime.utcnow()
    consents = db.query(UserConsent).filter(
        UserConsent.organization_pan == user.organization_pan,
        UserConsent.is_active == True
    ).all()

    for consent in consents:
        if consent.expires_at and consent.expires_at < now:
            continue
        try:
            allowed = json.loads(consent.allowed_departments)
        except Exception:
            allowed = [d.strip() for d in consent.allowed_departments.split(",") if d.strip()]

        # Check if all required departments are included or wildcard
        if "*" in allowed or all(dept in allowed for dept in required_departments):
            return consent

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "status": "CONSENT_REQUIRED",
            "message": f"Active consent required from {user.organization_name} ({user.organization_pan}) for departments: {required_departments}",
            "required_departments": required_departments
        }
    )
