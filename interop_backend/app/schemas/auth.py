from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict


class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., json_schema_extra={"example": "applicant@abcindustries.com"})
    password: str = Field(..., min_length=6, json_schema_extra={"example": "SecretPass123"})
    organization_name: str = Field(..., json_schema_extra={"example": "ABC Industries Pvt Ltd"})
    organization_pan: str = Field(..., json_schema_extra={"example": "ABCDE1234F"})
    role: Optional[str] = Field("APPLICANT", json_schema_extra={"example": "APPLICANT"})


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., json_schema_extra={"example": "applicant@abcindustries.com"})
    password: str = Field(..., json_schema_extra={"example": "SecretPass123"})


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    organization_pan: str
    organization_name: str


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    organization_name: str
    organization_pan: str
    role: str
    is_active: bool
