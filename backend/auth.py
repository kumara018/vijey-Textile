from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt as pyjwt
from jwt.exceptions import InvalidTokenError
import bcrypt
from fastapi import Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import os
from database import get_db
import models
import device_utils

ACTION_TOKEN_EXPIRE_MINUTES = 5

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
# Sliding session, like Amazon/Flipkart: this is the length of each renewal,
# not a hard logout deadline — get_current_user re-issues a fresh token (and
# pushes UserSession.expires_at forward by the same amount) on every active
# use, so a user who keeps using the site never hits this ceiling. Only a
# device that goes fully unused for the whole window actually logs out.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "129600"))  # 90 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    # JWT spec requires 'sub' to be a string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    return pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    response: Response = None,
) -> models.User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exc
        user_id = int(user_id_str)
        session_token: Optional[str] = payload.get("sid")
    except (InvalidTokenError, ValueError):
        raise credentials_exc

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exc

    # Tokens issued before the device-session feature have no "sid" claim —
    # honor them until they naturally expire (backward compatible).
    if session_token:
        session = db.query(models.UserSession).filter(
            models.UserSession.session_token == session_token,
        ).first()
        if session is None or session.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="You've been signed out of this device. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Throttled "last active" touch — avoid a DB write on every single
        # request. This is also where the sliding session renews: as long as
        # a device makes at least one request within the window, its expiry
        # keeps pushing forward and it never has to log back in — same as
        # Amazon/Flipkart. A device that goes fully quiet for the whole
        # window is the only way this naturally logs out on its own.
        now = datetime.now(timezone.utc)
        last = session.last_active_at
        if last and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if not last or (now - last).total_seconds() > 60:
            try:
                session.last_active_at = now
                session.expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

                # A transient geo-IP failure at login shouldn't leave a
                # device stuck showing "Unknown location" forever — retry
                # opportunistically until it succeeds.
                if not session.location and session.ip_address:
                    session.location = device_utils.geolocate_ip(session.ip_address)

                db.commit()

                if response is not None:
                    response.headers["X-New-Token"] = create_access_token(
                        {"sub": user.id, "sid": session_token}
                    )
            except Exception:
                db.rollback()

    return user


def create_action_token(purpose: str, **claims) -> str:
    """Short-lived (5 min) single-purpose token — e.g. completing a login
    after evicting a device, without re-asking for a password."""
    return create_access_token({"purpose": purpose, **claims}, expires_delta=timedelta(minutes=ACTION_TOKEN_EXPIRE_MINUTES))


def decode_action_token(token: str, purpose: str) -> dict:
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="This request has expired. Please try again.")
    if payload.get("purpose") != purpose:
        raise HTTPException(status_code=401, detail="Invalid request.")
    return payload


def get_current_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    try:
        return get_current_user(token, db)
    except Exception:
        return None
