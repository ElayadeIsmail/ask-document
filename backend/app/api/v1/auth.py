import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_settings_dep
from app.core.config import Settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.auth import LoginRequest, SignupRequest, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_out(user: User, settings: Settings) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(
            user.id, settings.jwt_secret, settings.access_token_expire_minutes
        ),
        user=UserOut.model_validate(user),
    )


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> TokenOut:
    email = payload.email.strip().lower()
    username = payload.username.strip().lower()
    existing = db.scalar(select(User).where((User.email == email) | (User.username == username)))
    if existing is not None:
        if existing.email == email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email is already used"
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username is already used"
        )
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        username=username,
        password_hash=hash_password(payload.password),
        role=UserRole.user.value,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email or username is already used"
        ) from None
    db.refresh(user)
    return _token_out(user, settings)


@router.post("/login", response_model=TokenOut)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> TokenOut:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return _token_out(user, settings)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
