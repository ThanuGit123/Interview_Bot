"""User Pydantic schemas."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserProfile(BaseModel):
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    preferred_persona: Optional[str] = None
    years_of_experience: Optional[int] = None
    key_skills: Optional[list[str]] = []

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    profile: Optional[UserProfile] = None
    
    class Config:
        populate_by_name = True

class TokenResponse(BaseModel):
    access_token: str
    user: UserResponse
