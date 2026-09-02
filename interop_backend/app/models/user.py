import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database import Base


def get_utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    organization_name = Column(String(255), nullable=False)
    organization_pan = Column(String(20), index=True, nullable=False)
    role = Column(String(50), default="APPLICANT", nullable=False)  # APPLICANT, GOVT_ADMIN, AUDITOR
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=get_utc_now)
