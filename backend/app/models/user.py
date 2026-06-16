"""User Pydantic schemas."""
from pydantic import BaseModel, EmailStr, Field

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
    
    class Config:
        populate_by_name = True

class TokenResponse(BaseModel):
    access_token: str
    user: UserResponse
