from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfileResponse,
)
from app.auth.jwt_handler import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication & Identity"])


@router.post(
    "/register",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Enterprise User",
    description="Create a new enterprise account with PAN and company details."
)
def register_user(body: UserRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "ERROR", "message": "User with this email already exists"}
        )

    new_user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        organization_name=body.organization_name,
        organization_pan=body.organization_pan.strip().upper(),
        role=body.role.upper() if body.role else "APPLICANT",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Enterprise User Login",
    description="Authenticate user credentials and receive JWT access token."
)
def login_user(body: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"status": "UNAUTHORIZED", "message": "Invalid email or password"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"status": "FORBIDDEN", "message": "Account is inactive"}
        )

    token = create_access_token({
        "sub": user.email,
        "role": user.role,
        "pan": user.organization_pan,
        "org": user.organization_name
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        organization_pan=user.organization_pan,
        organization_name=user.organization_name
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Current User Profile",
    description="Get authenticated profile information."
)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user
