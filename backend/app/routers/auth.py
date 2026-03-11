import hashlib
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.db import get_db
from app.models.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
)
from app.services.email import send_reset_code_email

router = APIRouter()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__truncate_error=True,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _users_collection():
    return get_db().collection("users")


def _make_username(name: str) -> str:
    base = name.strip().lower().replace(" ", "*")
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{base}_{suffix}"


def _generate_reset_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _validate_bcrypt_password(password: str) -> None:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too long. Maximum allowed length is 72 bytes.",
        )


def verify_password(plain: str, hashed: str) -> bool:
    _validate_bcrypt_password(plain)
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too long. Maximum allowed length is 72 bytes.",
        ) from exc


def hash_password(plain: str) -> str:
    _validate_bcrypt_password(plain)
    try:
        return pwd_context.hash(plain)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too long. Maximum allowed length is 72 bytes.",
        ) from exc


def _verify_legacy_sha256_password(plain: str, hashed: str) -> bool:
    candidate = hashlib.sha256(plain.encode("utf-8")).hexdigest()
    return candidate == (hashed or "").strip()


def verify_and_maybe_migrate_password(plain: str, hashed: str) -> Tuple[bool, Optional[str]]:
    if not hashed:
        return False, None

    hashed = hashed.strip()

    if hashed.startswith(("$2a$", "$2b$", "$2y$")):
        return verify_password(plain, hashed), None

    if len(hashed) == 64 and all(char in string.hexdigits for char in hashed):
        if _verify_legacy_sha256_password(plain, hashed):
            return True, hash_password(plain)

    return False, None


def create_access_token(data: dict, expire_minutes: int | None = None) -> str:
    to_encode = data.copy()
    minutes = expire_minutes if expire_minutes else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _normalize_user(doc_id: str, payload: dict) -> UserOut:
    return UserOut(
        id=doc_id,
        name=payload.get("name", ""),
        email=payload.get("email", ""),
        username=payload.get("username", ""),
        phone=payload.get("phone"),
        avatar_url=payload.get("avatar_url") or payload.get("avatarUrl"),
    )


def _get_user_by_email(email: str):
    docs = _users_collection().where("email", "==", email).limit(1).stream()
    return next(docs, None)


def _serialize_reset_expiry(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()

    return str(value)


def _parse_reset_expiry(value) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    return None


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserOut:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user_doc = _get_user_by_email(email)
    if user_doc is None or not user_doc.exists:
        raise credentials_exception

    return _normalize_user(user_doc.id, user_doc.to_dict())


@router.post("/register")
async def register(body: RegisterRequest):
    existing = _get_user_by_email(body.email)
    if existing is not None and existing.exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_id = str(uuid.uuid4())
    username = _make_username(body.name)
    hashed = hash_password(body.password)
    avatar_url = (
        "https://ui-avatars.com/api/"
        f"?name={body.name.replace(' ', '+')}&background=7c3aed&color=fff&size=80"
    )

    _users_collection().document(user_id).set(
        {
            "id": user_id,
            "name": body.name,
            "email": body.email,
            "username": username,
            "phone": None,
            "avatar_url": avatar_url,
            "hashed_password": hashed,
            "reset_code": None,
            "reset_code_expires": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"message": "Account created successfully"}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user_doc = _get_user_by_email(body.email)
    if user_doc is None or not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_data = user_doc.to_dict()
    is_valid, migrated_hash = verify_and_maybe_migrate_password(
        body.password, user_data.get("hashed_password", "")
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if migrated_hash:
        user_doc.reference.update({"hashed_password": migrated_hash})
        user_data["hashed_password"] = migrated_hash

    expire_minutes = (
        settings.REMEMBER_ME_EXPIRE_MINUTES
        if body.remember_me
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    token = create_access_token({"sub": user_data["email"]}, expire_minutes)

    return TokenResponse(
        access_token=token,
        user=_normalize_user(user_doc.id, user_data),
    )


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    user_doc = _get_user_by_email(body.email)
    if user_doc is None or not user_doc.exists:
        return {"message": "If the email exists, a reset code has been sent"}

    code = _generate_reset_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    user_doc.reference.update(
        {
            "reset_code": code,
            "reset_code_expires": _serialize_reset_expiry(expires),
        }
    )

    try:
        send_reset_code_email(body.email, code)
    except RuntimeError as exc:
        print("Email error:", exc)
        raise HTTPException(
            status_code=502,
            detail="Email sending failed. Check SMTP settings",
        ) from exc

    return {"message": "Reset code sent"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    user_doc = _get_user_by_email(body.email)
    if user_doc is None or not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or code",
        )

    user_data = user_doc.to_dict()
    stored_code = user_data.get("reset_code")
    expires = _parse_reset_expiry(user_data.get("reset_code_expires"))

    if stored_code != body.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset code",
        )

    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code expired",
        )

    new_hash = hash_password(body.new_password)
    user_doc.reference.update(
        {
            "hashed_password": new_hash,
            "reset_code": None,
            "reset_code_expires": None,
        }
    )

    return {"message": "Password reset successful"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: UserOut = Depends(get_current_user)):
    return current_user
