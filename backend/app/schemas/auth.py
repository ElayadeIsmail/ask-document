from datetime import datetime

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    username: str = Field(min_length=2, max_length=32, pattern=r"^[A-Za-z0-9_\.]+$")
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    id: str
    username: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AdminDocumentOut(BaseModel):
    id: str
    filename: str
    status: str
    collection_id: str
    collection_name: str
    page_count: int
    created_at: datetime


class AdminUserOut(UserOut):
    documents: list[AdminDocumentOut] = Field(default_factory=list)
