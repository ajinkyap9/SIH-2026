import json
import datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List

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
    # sub can be email or PAN (for OTP login without email)
    sub: str = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"status": "UNAUTHORIZED", "message": "Invalid token payload"}
        )
    # Try lookup by email first, then by PAN
    user = (
        db.query(User).filter(User.email == sub, User.is_active == True).first()
        or db.query(User).filter(User.organization_pan == sub, User.is_active == True).first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"status": "UNAUTHORIZED", "message": "User not found or inactive"}
        )
    return user


def check_consent_for_departments(
    db: Session,
    user: User,
    required_departments: List[str]
) -> UserConsent:
    """Verifies that active, unexpired consent exists for all required departments."""
    now = datetime.datetime.now(datetime.timezone.utc)
    consents = db.query(UserConsent).filter(
        UserConsent.organization_pan == user.organization_pan,
        UserConsent.is_active == True
    ).all()

    for consent in consents:
        if consent.expires_at:
            exp = consent.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=datetime.timezone.utc)
            if exp < now:
                continue
        try:
            allowed = json.loads(consent.allowed_departments)
        except Exception:
            allowed = [d.strip() for d in consent.allowed_departments.split(",") if d.strip()]

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
