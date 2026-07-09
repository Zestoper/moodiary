from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegister(BaseModel):

    email: EmailStr
    username: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=6)

class UserLogin(BaseModel):

    email: EmailStr
    password: str

class TokenResponse(BaseModel):

    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    preferences: Optional[str] = None
    is_admin: bool = False
    credits: int = 0

    class Config:
        from_attributes = True
