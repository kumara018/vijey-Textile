import os, re, random, secrets, smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
import notifications
import device_utils
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
import models, schemas, auth as auth_utils
from rate_limit import (
    enforce_ip_limit, enforce_identifier_limit,
    SEND_CODE, VERIFY_CODE, REGISTER, SESSION_SWAP,
    BEGIN_PER_IP, BEGIN_PER_IDENTIFIER,
    LOOKUP_PER_IP, LOOKUP_PER_IDENTIFIER,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# AUTH-SPEC R3 — a constant to verify against when there is no user.
#
# Computed once at import, never compared for truth. Its only purpose is to
# give `verify_password` something real to chew on so an absent account costs
# the same as a present one. bcrypt is slow BY DESIGN — that is the whole point
# of it — and the previous code let Python's `or` short-circuit past it:
#
#     if not user or not verify_password(payload.password, user.password_hash)
#
# When `user` was None the hash never ran, so a missing account answered in
# microseconds and a real account with a wrong password took ~100ms. The bodies
# were identical; the TIMES differed by three orders of magnitude. That gap is
# stable, measurable from anywhere, needs no credentials, and is the actual
# enumeration vector on these endpoints.
_DUMMY_HASH = auth_utils.hash_password("not-a-real-password-only-for-timing")



MAX_DEVICES = 4

# ── helpers ───────────────────────────────────────────────────────────────────

def _is_email(value: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", value))

def _normalize_phone(v: str) -> str:
    v = v.strip().replace(" ", "").replace("-", "")
    # Indian numbers — strip country code prefix, store as 10 digits
    if v.startswith("+91"):
        v = v[3:]
    elif v.startswith("91") and len(v) == 12 and v[2:3] in "6789":
        v = v[2:]
    elif v.startswith("0") and len(v) == 11:
        v = v[1:]
    # International numbers (e.g. "+14155551234") stored as-is
    return v

def _find_user(db: Session, identifier: str):
    """Find user by email or phone."""
    identifier = identifier.strip()
    if _is_email(identifier):
        return db.query(models.User).filter(
            models.User.email == identifier.lower()
        ).first()
    else:
        phone = _normalize_phone(identifier)
        return db.query(models.User).filter(
            models.User.phone == phone
        ).first()

def _send_otp_email(to_email: str, otp: str, purpose: str = "Password Reset"):
    """
    Send a code by email, through the one SMTP path the rest of the app uses.

    THIS FUNCTION USED TO OPEN smtp.gmail.com:465 ITSELF, a second hardcoded
    Gmail endpoint alongside the one in notifications.py. Two copies meant a
    host fix could be applied to one and forgotten on the other, and it also
    meant this path failed for exactly the same reason: the shop's mailbox is
    not Gmail. `notifications._smtp_send` now owns connecting, so there is a
    single place where the host is decided.

    The console fallback is kept and is deliberate. When mail cannot go out at
    all, printing the code is the difference between an owner who can still
    reach their own admin through the deploy logs and one who is locked out of
    their shop. It is not a leak: reading it already requires access to the
    server's logs.
    """
    if not notifications.SMTP_EMAIL or not notifications.SMTP_PASS:
        print(f"[OTP] {purpose} OTP for {to_email}: {otp}")
        return

    msg = MIMEText(
        f"Your Vijey Textile {purpose} OTP is: {otp}\n\n"
        f"This OTP is valid for 10 minutes.\n"
        f"Do not share this OTP with anyone.\n\n"
        f"— Vijey Textile Team"
    )
    msg["Subject"] = f"Vijey Textile — {purpose} OTP: {otp}"
    msg["From"]    = notifications.SMTP_EMAIL
    msg["To"]      = to_email

    if not notifications._smtp_send(to_email, msg["Subject"], msg):
        print(f"[OTP] {purpose} OTP for {to_email}: {otp}")

def _create_otp(db: Session, identifier: str, otp_type: str = "reset") -> str:
    """Create a 6-digit OTP and store in DB."""
    # Delete any existing OTPs for this identifier
    db.query(models.OTPStore).filter(
        models.OTPStore.identifier == identifier,
        models.OTPStore.otp_type  == otp_type,
    ).delete()
    db.commit()

    otp = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    record = models.OTPStore(
        identifier=identifier,
        otp_code=otp,
        otp_type=otp_type,
        expires_at=expires,
    )
    db.add(record)
    db.commit()
    return otp

def _verify_otp(db: Session, identifier: str, otp_code: str, otp_type: str = "reset") -> bool:
    """Verify OTP. Returns True if valid."""
    record = db.query(models.OTPStore).filter(
        models.OTPStore.identifier == identifier,
        models.OTPStore.otp_code   == otp_code,
        models.OTPStore.otp_type   == otp_type,
        models.OTPStore.is_used    == False,
    ).first()
    if not record:
        return False
    now = datetime.now(timezone.utc)
    if record.expires_at.tzinfo is None:
        record.expires_at = record.expires_at.replace(tzinfo=timezone.utc)
    if now > record.expires_at:
        return False
    record.is_used = True
    db.commit()
    return True


def _active_sessions(db: Session, user_id: int):
    """
    "Active" = not signed out AND not past its sliding expiry. NULL
    expires_at is treated as not-expired (covers rows from before this
    column existed) — get_current_user backfills a real value onto it the
    next time that session is actually used, so this only matters for a
    session that's been fully quiet since before the migration ran.
    """
    now = datetime.now(timezone.utc)
    return (
        db.query(models.UserSession)
        .filter(
            models.UserSession.user_id == user_id,
            models.UserSession.revoked_at.is_(None),
            or_(models.UserSession.expires_at.is_(None), models.UserSession.expires_at > now),
        )
        .order_by(models.UserSession.last_active_at.desc())
        .all()
    )


def _session_to_dict(s: models.UserSession) -> dict:
    return {
        "id": s.id,
        "device_name": s.device_name,
        "os_name": s.os_name,
        "browser_name": s.browser_name,
        "device_type": s.device_type,
        "location": s.location,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
    }


def _create_session_or_409(db: Session, user: models.User, request: Request) -> str:
    """Create a new device session, enforcing the MAX_DEVICES cap. If the user
    is already at the cap, raises a 409 carrying their active device list plus
    a short-lived pending_token so the frontend can let them pick one to sign
    out of, then call /sessions/evict-and-login to finish."""
    active = _active_sessions(db, user.id)
    if len(active) >= MAX_DEVICES:
        pending = auth_utils.create_action_token("device_evict", uid=user.id)
        raise HTTPException(status_code=409, detail={
            "code": "device_limit",
            "message": f"You're signed in on {MAX_DEVICES} devices already — the maximum allowed. Sign out of one to continue.",
            "pending_token": pending,
            "sessions": [_session_to_dict(s) for s in active],
        })

    ua = request.headers.get("user-agent", "") if request else ""
    info = device_utils.parse_user_agent(ua)
    ip = device_utils.get_client_ip(request) if request else ""
    location = device_utils.geolocate_ip(ip)

    # Logging in again from a browser/device that already has an active
    # session (e.g. it signed out client-side without hitting /logout, or a
    # previous session just lapsed) replaces that old entry instead of
    # sitting alongside it — otherwise the same physical device shows up
    # twice in Linked Devices, which is exactly the "why is my old login
    # still here" confusion this is meant to prevent.
    same_device = [
        s for s in active
        if s.device_name == info["device_name"]
        and s.os_name == info["os_name"]
        and s.browser_name == info["browser_name"]
        and s.device_type == info["device_type"]
    ]
    for s in same_device:
        s.revoked_at = datetime.now(timezone.utc)
    if same_device:
        db.commit()

    session_token = secrets.token_urlsafe(32)
    row = models.UserSession(
        user_id=user.id,
        session_token=session_token,
        device_name=info["device_name"],
        os_name=info["os_name"],
        browser_name=info["browser_name"],
        device_type=info["device_type"],
        ip_address=ip,
        location=location,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=auth_utils.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    db.add(row)
    db.commit()

    notifications.send_login_notification_email(
        user.email, user.full_name,
        device_name=info["device_name"], location=location,
    )
    return session_token


# ── REGISTER ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(request: Request, payload: schemas.UserRegister, db: Session = Depends(get_db)):
    """Step 1 of signup: create the (unverified) account and send a 6-digit
    OTP to both email and mobile. The account only becomes usable once
    /verify-register-otp confirms it — see that endpoint for the token."""
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "register", REGISTER)
    existing_email = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing_email and existing_email.is_verified:
        raise HTTPException(409, "An account with this email already exists. Please login.")

    phone = _normalize_phone(payload.phone)
    existing_phone = db.query(models.User).filter(models.User.phone == phone).first()
    if existing_phone and existing_phone.is_verified and (not existing_email or existing_phone.id != existing_email.id):
        raise HTTPException(409, "This phone number is already registered.")

    if existing_email and not existing_email.is_verified:
        # Resume/overwrite an abandoned, never-verified signup attempt.
        user = existing_email
        user.full_name     = payload.full_name.strip()
        user.phone         = phone
        user.password_hash = auth_utils.hash_password(payload.password)
    else:
        user = models.User(
            full_name     = payload.full_name.strip(),
            email         = payload.email.lower(),
            phone         = phone,
            password_hash = auth_utils.hash_password(payload.password),
            is_verified   = False,
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    otp = _create_otp(db, user.email, otp_type="register")
    notifications.send_register_otp_email(user.email, user.full_name, otp)
    notifications.send_otp_sms(user.phone, otp, "Account Verification")

    hint = user.email[:3] + "***@" + user.email.split("@")[-1]
    return {"message": "OTP sent to your email and mobile to verify your new account.", "email_hint": hint}


# ── VERIFY REGISTRATION OTP (Step 2) ──────────────────────────────────────────

@router.post("/verify-register-otp", response_model=schemas.Token)
def verify_register_otp(request: Request, payload: schemas.LoginOTPVerify, db: Session = Depends(get_db)):
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "verify-register-otp", VERIFY_CODE)
    user = _find_user(db, payload.identifier)
    if not user:
        raise HTTPException(404, "Account not found.")
    if user.is_verified:
        raise HTTPException(400, "This account is already verified. Please login.")

    if not _verify_otp(db, user.email, payload.otp_code, otp_type="register"):
        raise HTTPException(400, "Invalid or expired OTP. Please request a new one.")

    user.is_verified = True
    db.commit()

    session_token = _create_session_or_409(db, user, request)
    token = auth_utils.create_access_token({"sub": user.id, "sid": session_token})

    notifications.send_welcome_email(user.email, user.full_name)
    notifications.send_welcome_sms(user.phone, user.full_name)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── RESEND REGISTRATION OTP ───────────────────────────────────────────────────

@router.post("/resend-register-otp")
def resend_register_otp(request: Request, payload: schemas.OTPRequest, db: Session = Depends(get_db)):
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "resend-register-otp", SEND_CODE)
    user = _find_user(db, payload.identifier)
    if not user or user.is_verified:
        return {"message": "If a pending signup exists for this account, a new OTP has been sent."}
    otp = _create_otp(db, user.email, otp_type="register")
    notifications.send_register_otp_email(user.email, user.full_name, otp)
    notifications.send_otp_sms(user.phone, otp, "Account Verification")
    hint = user.email[:3] + "***@" + user.email.split("@")[-1]
    return {"message": "OTP resent to your email and mobile.", "email_hint": hint}


# ── LOGIN (email OR phone) ────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Password sign-in, kept alive alongside the OTP flow.

    It had NO rate limit — the eight decorated endpoints all did, and this one
    was missed because it is the older path the frontend no longer leads with.
    An unthrottled endpoint that takes an identifier and a password and answers
    differently for each is the most valuable target on the router, whether or
    not the shop's own UI still uses it.
    """
    enforce_ip_limit(db, request, "login", VERIFY_CODE)
    enforce_identifier_limit(db, payload.identifier)
    user = _find_user(db, payload.identifier)

    # AUTH-SPEC R3: always pay the hash, so presence and absence cost the same.
    # `password_ok` is computed BEFORE the branch precisely so that no `or`
    # can skip it.
    password_ok = auth_utils.verify_password(
        payload.password, user.password_hash if user else _DUMMY_HASH
    )
    if not user or not password_ok:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email/phone or password. Please check and try again.",
        )
    if not user.is_active:
        raise HTTPException(403, "Your account has been deactivated. Contact support.")
    if not user.is_verified:
        raise HTTPException(403, "Please verify your account first — check your email/SMS for the verification code.")

    session_token = _create_session_or_409(db, user, request)
    token = auth_utils.create_access_token({"sub": user.id, "sid": session_token})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── GET ME ────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.UserOut)
def get_me(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    # Tokens issued before device-session tracking shipped have no "sid"
    # claim, so they never show up in Linked Devices even though they're
    # actively signed in. Silently upgrade them here — the frontend picks
    # up the new token from this header on its next /me call, no re-login
    # required. Skipped (not an error) if they're already at the device cap.
    if not _current_session_token(request):
        try:
            session_token = _create_session_or_409(db, current_user, request)
            response.headers["X-New-Token"] = auth_utils.create_access_token(
                {"sub": current_user.id, "sid": session_token}
            )
        except HTTPException:
            pass
    return current_user


# ── UPDATE PROFILE ────────────────────────────────────────────────────────────

@router.put("/me", response_model=schemas.UserOut)
def update_profile(
    payload:      schemas.UserUpdate,
    db:           Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ── FORGOT PASSWORD — send OTP ────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(request: Request, payload: schemas.OTPRequest, db: Session = Depends(get_db)):
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "forgot-password", SEND_CODE)
    # AUTH-SPEC R1: per-identifier ceiling, on top of the per-IP one.
    enforce_identifier_limit(db, payload.identifier)
    identifier = payload.identifier.strip()
    user = _find_user(db, identifier)

    # AUTH-SPEC R2. The old code carried a comment saying "Don't reveal if user
    # exists" directly above a branch that revealed it: a missing account got
    # "If this account exists, an OTP has been sent" while a real one got
    # "OTP sent to your registered email (abc***)" PLUS an `email_hint` field.
    # Two different shapes, one of them with an extra key. A single request
    # answered "is this phone number a customer of yours".
    #
    # One response now, on both paths, with no branch and no hint. The comment
    # and the code finally agree.
    if user:
        otp = _create_otp(db, user.email, otp_type="reset")
        notifications.send_password_reset_otp_email(user.email, user.full_name, otp)

    return {
        "message": (
            "If an account exists for that phone or email, we have sent a code "
            "to its registered email address. It is valid for 10 minutes."
        )
    }


# ── VERIFY OTP & RESET PASSWORD ───────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(request: Request, payload: schemas.OTPVerify, db: Session = Depends(get_db)):
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "reset-password", VERIFY_CODE)
    identifier = payload.identifier.strip()
    user = _find_user(db, identifier)
    if not user:
        raise HTTPException(404, "Account not found")

    if not _verify_otp(db, user.email, payload.otp_code, otp_type="reset"):
        raise HTTPException(400, "Invalid or expired OTP. Please request a new one.")

    user.password_hash = auth_utils.hash_password(payload.new_password)
    db.commit()

    return {"message": "Password reset successfully. Please login with your new password."}


# ── SEND LOGIN OTP (Step 1) ───────────────────────────────────────────────────

@router.post("/send-login-otp")
def send_login_otp(request: Request, payload: schemas.UserLogin, db: Session = Depends(get_db)):
    """Verify credentials then send a 6-digit OTP to the user's email."""
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "send-login-otp", SEND_CODE)
    # AUTH-SPEC R1: per-identifier ceiling, on top of the per-IP one.
    enforce_identifier_limit(db, payload.identifier)
    user = _find_user(db, payload.identifier)
    # AUTH-SPEC R3: always pay the hash, so presence and absence cost the same.
    # `password_ok` is computed BEFORE the branch precisely so that no `or`
    # can skip it.
    password_ok = auth_utils.verify_password(
        payload.password, user.password_hash if user else _DUMMY_HASH
    )
    if not user or not password_ok:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email/phone or password. Please check and try again.",
        )
    if not user.is_active:
        raise HTTPException(403, "Your account has been deactivated. Contact support.")
    if not user.is_verified:
        raise HTTPException(403, "Please verify your account first — check your email/SMS for the verification code.")

    otp  = _create_otp(db, user.email, otp_type="login")
    # Send styled HTML OTP email + optional SMS
    notifications.send_login_otp_email(user.email, user.full_name, otp)
    notifications.send_otp_sms(user.phone, otp, "Login")

    hint = user.email[:3] + "***@" + user.email.split("@")[-1]
    is_deactivated = bool(getattr(user, 'is_deactivated', False))
    return {
        "message":        "OTP sent to your registered email.",
        "email_hint":     hint,
        "is_deactivated": is_deactivated,
    }


# ── VERIFY LOGIN OTP (Step 2) ─────────────────────────────────────────────────

@router.post("/verify-login-otp", response_model=schemas.Token)
def verify_login_otp(request: Request, payload: schemas.LoginOTPVerify, db: Session = Depends(get_db)):
    """Verify the 6-digit OTP and return a JWT if correct."""
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "verify-login-otp", VERIFY_CODE)
    user = _find_user(db, payload.identifier)
    if not user:
        raise HTTPException(404, "Account not found.")
    if not user.is_active:
        raise HTTPException(403, "Your account has been deactivated. Contact support.")

    # If account is deactivated by the user → auto-reactivate on successful login
    if getattr(user, 'is_deactivated', False):
        user.is_deactivated      = False
        user.deactivated_at      = None
        user.scheduled_delete_at = None
        db.commit()

    # Check if account is past its deletion window
    if user.scheduled_delete_at:
        now = datetime.now(timezone.utc)
        sda = user.scheduled_delete_at
        if sda.tzinfo is None:
            sda = sda.replace(tzinfo=timezone.utc)
        if now > sda:
            raise HTTPException(401, "This account has been permanently deleted.")
        # Logged in within window → auto-cancel deletion + notify
        user.scheduled_delete_at = None
        db.commit()
        notifications.send_account_retrieved_email(user.email, user.full_name)

    if not _verify_otp(db, user.email, payload.otp_code, otp_type="login"):
        raise HTTPException(400, "Invalid or expired OTP. Please request a new one.")

    session_token = _create_session_or_409(db, user, request)
    token = auth_utils.create_access_token({"sub": user.id, "sid": session_token})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── REQUEST ACCOUNT DELETION ───────────────────────────────────────────────────

@router.post("/request-delete-account")
def request_delete_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Send OTP to confirm account deletion."""
    otp = _create_otp(db, current_user.email, otp_type="delete")
    notifications.send_deletion_otp_email(current_user.email, current_user.full_name, otp)
    notifications.send_otp_sms(current_user.phone, otp, "Account Deletion")
    hint = current_user.email[:3] + "***@" + current_user.email.split("@")[-1]
    smtp_ready = bool(os.getenv("SMTP_EMAIL") and os.getenv("SMTP_PASSWORD"))
    response: dict = {"message": "OTP sent to your email and mobile to confirm deletion.", "email_hint": hint}
    if not smtp_ready:
        response["dev_otp"] = otp
    return response


# ── CONFIRM ACCOUNT DELETION ───────────────────────────────────────────────────

@router.post("/confirm-delete-account")
def confirm_delete_account(
    payload: schemas.DeleteAccountConfirm,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Verify OTP → schedule permanent deletion in 4 hours."""
    if not _verify_otp(db, current_user.email, payload.otp_code, otp_type="delete"):
        raise HTTPException(400, "Invalid or expired OTP.")
    hours = notifications.DELETE_HOURS
    delete_at = datetime.now(timezone.utc) + timedelta(hours=hours)
    current_user.scheduled_delete_at = delete_at
    db.commit()
    notifications.send_deletion_scheduled_email(current_user.email, current_user.full_name, delete_at)
    return {
        "message": f"Account scheduled for permanent deletion in {hours} hours.",
        "delete_at": delete_at.isoformat(),
        "cancel_info": f"Log in within {hours} hours to cancel deletion.",
        "hours": hours,
    }


# ── CANCEL ACCOUNT DELETION ────────────────────────────────────────────────────

@router.post("/cancel-delete-account")
def cancel_delete_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Cancel a pending deletion — sends account-retrieved confirmation email."""
    had_pending = bool(current_user.scheduled_delete_at)
    current_user.scheduled_delete_at = None
    current_user.is_deactivated      = False
    current_user.deactivated_at      = None
    db.commit()
    if had_pending:
        notifications.send_account_retrieved_email(current_user.email, current_user.full_name)
    return {"message": "Account deletion cancelled. Your account is safe! ✅"}


# ── REQUEST TEMPORARY DEACTIVATION ─────────────────────────────────────────────

@router.post("/request-deactivate-account")
def request_deactivate_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Send OTP to confirm temporary account deactivation (7-day soft suspend)."""
    otp = _create_otp(db, current_user.email, otp_type="deactivate")
    notifications.send_deletion_otp_email(current_user.email, current_user.full_name, otp, window_text="7 days")
    hint = current_user.email[:3] + "***@" + current_user.email.split("@")[-1]
    return {
        "message": "OTP sent to your email to confirm temporary deactivation.",
        "email_hint": hint,
    }


# ── CONFIRM TEMPORARY DEACTIVATION ─────────────────────────────────────────────

@router.post("/confirm-deactivate-account")
def confirm_deactivate_account(
    payload: schemas.DeleteAccountConfirm,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """
    Verify OTP → suspend account for 7 days.
    After 7 days the account is permanently deleted (scheduled_delete_at).
    User can reactivate any time within 7 days by logging in.
    """
    if not _verify_otp(db, current_user.email, payload.otp_code, otp_type="deactivate"):
        raise HTTPException(400, "Invalid or expired OTP.")

    now        = datetime.now(timezone.utc)
    delete_at  = now + timedelta(days=7)

    current_user.is_deactivated      = True
    current_user.deactivated_at      = now
    current_user.scheduled_delete_at = delete_at   # auto-delete after 7 days
    db.commit()

    notifications.send_deletion_scheduled_email(current_user.email, current_user.full_name, delete_at)

    return {
        "message": "Account deactivated. You can reactivate within 7 days by signing in.",
        "reactivate_before": delete_at.isoformat(),
    }


# ── PROGRESSIVE SIGN-IN (AUTH-SPEC R6, Option B) ──────────────────────────────
#
# One field. Type a phone number or an email, get a code, and only after you
# have proved you control it does the site say anything about whether an account
# exists. The existing `identifier + password -> OTP -> token` flow stays live
# and untouched; this sits beside it so the frontend can migrate last.
#
# WHY OPTION B AND NOT OPTION A. Option A ("does this exist?" then mitigate) is
# what Amazon does and it is additive, which is its main argument. It is also an
# enumeration oracle by construction, and every mitigation for it is a race
# between the rate limiter and a proxy pool. Option B never answers the
# question: the reply to /begin is assembled entirely from what the CALLER sent,
# so there is no branch for a timing or content difference to leak through.
#
# This also settles R4. R4 only mattered for Option A's /identify endpoint —
# under B there is no existence-answering endpoint, so there is nothing to time.
# The spec says exactly this: "R4 only if Option A is chosen."
#
# THE COST, STATED PLAINLY. Every probe sends a real SMS. That is the trade: the
# oracle is gone and the spend is real, so the budgets here are the tightest on
# the router — three per identifier per hour, ten per address per hour, which
# are the spec's own numbers. Without them this endpoint is an SMS-bombing tool
# pointed at any number an attacker likes.


#: A normalised phone number that could actually belong to somebody: digits,
#: optionally with a country code, in the length range E.164 allows.
_PHONE_SHAPE = re.compile(r"^\+?\d{7,15}$")


def _looks_like_contact(raw: str) -> bool:
    """
    Whether this is even a phone number or an email address.

    `_normalize_phone` does not answer that — it strips separators and known
    Indian prefixes and hands back whatever is left, so "not-a-contact" comes
    out as the perfectly truthy "notacontact". Every caller that tested it for
    truthiness was therefore accepting free text as a phone number.
    """
    value = (raw or "").strip()
    if not value:
        return False
    return _is_email(value) or bool(_PHONE_SHAPE.match(_normalize_phone(value)))


def _identifier_hint(identifier: str) -> str:
    """
    A masked echo of what the caller typed. Never of what is stored.

    This is the part that has to be got right for the whole design to hold. A
    hint built from a found user's record would differ — in length, in masking,
    in the domain — between an account that exists and one that does not, and
    the endpoint would be right back to answering the question it exists to
    refuse. Everything here is derived from the submitted string.
    """
    value = (identifier or "").strip()
    if _is_email(value):
        local, _, domain = value.partition("@")
        head = local[:2] if len(local) > 2 else local[:1]
        return f"{head}***@{domain}" if domain else f"{head}***"
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 4:
        return f"{digits[:2]}***{digits[-2:]}"
    return "***"


@router.post("/lookup", response_model=schemas.AuthLookupOut)
def auth_lookup(request: Request, payload: schemas.AuthLookupIn, db: Session = Depends(get_db)):
    """
    Does this phone or email have an account? Asked by the sign-in form's first
    step, so a new customer is offered Create Account instead of being failed on
    a password they were never going to have.

    THIS IS AN ENUMERATION ORACLE AND IS MEANT TO BE ONE. It is worth being
    plain about that rather than letting a future reader discover it.

    What makes it acceptable here is that it is not a new capability. /register
    already answers the identical question — "An account with this email already
    exists", "This phone number is already registered" — on a cheaper budget
    (20/hour per IP). Anyone who wanted this answer has always had it. The
    alternative on offer was the /begin + /continue blind branch, which proves
    control of the identifier before it says anything; that costs an SMS per
    attempt, and this shop's Twilio account is a trial that can only message
    verified numbers, so routing sign-in through it would leave every customer
    who types a phone number waiting for a code that is never coming.

    So: rate limited no more permissively than the endpoint that already leaks
    this, and the reply carries EXACTLY one bit plus a masked echo of what was
    typed. No name, no email, no clue whether the miss was the number or the
    domain. `_identifier_hint` is built from the submitted string and never from
    a stored record, so the hint cannot leak either.

    An account that exists but was never verified answers `false` on purpose.
    /register resumes an abandoned signup, so that customer is better served by
    the create-account form than by a password screen their password will not
    open.
    """
    enforce_ip_limit(db, request, "auth-lookup", LOOKUP_PER_IP)
    enforce_identifier_limit(db, payload.identifier, LOOKUP_PER_IDENTIFIER)

    raw = (payload.identifier or "").strip()
    if not raw:
        raise HTTPException(400, "Enter your mobile number or email address.")

    if not _looks_like_contact(raw):
        raise HTTPException(400, "That does not look like a mobile number or an email address.")

    user = _find_user(db, raw)
    return {
        "exists": bool(user and user.is_verified),
        "hint": _identifier_hint(raw),
    }


@router.post("/begin", response_model=schemas.AuthBeginOut)
def auth_begin(request: Request, payload: schemas.AuthBeginIn, db: Session = Depends(get_db)):
    """
    Step one: send a code to whatever was typed. Answer the same way every time.

    THERE IS DELIBERATELY NO USER LOOKUP IN THIS FUNCTION. Not a lookup whose
    result is ignored, not a lookup behind a constant-time compare — none at
    all. A lookup that does not happen cannot leak through timing, through an
    error path, through a log line, or through a future edit by someone who does
    not know why the branch was written the way it was. The response is built
    from the submitted identifier and nothing else, so "byte-identical whether
    or not the account exists" is a property of the code's shape rather than
    something maintained by care.
    """
    enforce_ip_limit(db, request, "auth-begin", BEGIN_PER_IP)
    enforce_identifier_limit(db, payload.identifier, BEGIN_PER_IDENTIFIER)

    raw = (payload.identifier or "").strip()
    if not raw:
        raise HTTPException(400, "Enter your mobile number or email address.")

    if _is_email(raw):
        key, channel = raw.lower(), "email"
    else:
        key, channel = _normalize_phone(raw), "sms"
        if not key:
            raise HTTPException(400, "That does not look like a mobile number or an email address.")

    otp = _create_otp(db, key, otp_type="begin")

    # Best-effort delivery, exactly like every other send on this router: a
    # failed SMS gateway must not turn into a 500 that tells the caller
    # something about this particular identifier.
    try:
        if channel == "email":
            _send_otp_email(key, otp, purpose="Sign in")
        else:
            notifications.send_otp_sms(key, otp, "Sign in")
    except Exception:
        pass

    return {"sent": True, "channel": channel, "hint": _identifier_hint(raw)}


@router.post("/continue", response_model=schemas.AuthContinueOut)
def auth_continue(request: Request, payload: schemas.AuthContinueIn, db: Session = Depends(get_db)):
    """
    Step two: the branch, taken only after control of the identifier is proven.

    By the time this returns anything about an account, the caller has entered a
    code that was sent to that address or number. Telling them at that point
    whether it is registered is not a leak — they own it.

    A wrong or expired code gets one 401 with one wording, whether the account
    exists or not. That matters: an attacker who could distinguish "bad code for
    a real account" from "bad code for no account" would have the oracle back
    one step later.
    """
    enforce_ip_limit(db, request, "auth-continue", VERIFY_CODE)

    raw = (payload.identifier or "").strip()
    key = raw.lower() if _is_email(raw) else _normalize_phone(raw)
    if not key or not _verify_otp(db, key, payload.otp, otp_type="begin"):
        raise HTTPException(401, "That code is not right or has expired.")

    user = _find_user(db, raw)

    if user:
        return {
            "next": "password",
            "user_hint": {"full_name": user.full_name, "hint": _identifier_hint(raw)},
            "registration_token": None,
        }

    # No account. Hand back a short-lived, purpose-scoped token so the
    # create-account form does not make them prove the same number twice —
    # the same pattern as the `device_evict` token issued at the 4-device cap.
    return {
        "next": "register",
        "user_hint": None,
        "registration_token": auth_utils.create_action_token(
            "registration", identifier=key, channel="email" if _is_email(raw) else "sms",
        ),
    }


# ── LINKED DEVICES ─────────────────────────────────────────────────────────────

def _current_session_token(request: Request) -> str | None:
    authz = request.headers.get("authorization", "")
    if not authz.lower().startswith("bearer "):
        return None
    raw = authz.split(" ", 1)[1]
    try:
        import jwt as pyjwt
        payload = pyjwt.decode(raw, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        return payload.get("sid")
    except Exception:
        return None


@router.get("/sessions", response_model=list[schemas.SessionOut])
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """All devices currently signed in to this account — powers the
    WhatsApp-style 'Linked Devices' dashboard."""
    current_token = _current_session_token(request)
    active = _active_sessions(db, current_user.id)

    # Being able to make this authenticated request at all proves the
    # current session is genuinely valid right now — it must never be
    # missing from its own device list because of an expiry edge case
    # (e.g. a row created before expires_at existed, or one whose sliding
    # refresh hasn't landed on this exact request yet). Self-heal it here.
    if current_token and not any(s.session_token == current_token for s in active):
        current = db.query(models.UserSession).filter(
            models.UserSession.session_token == current_token,
            models.UserSession.user_id == current_user.id,
            models.UserSession.revoked_at.is_(None),
        ).first()
        if current:
            current.expires_at = datetime.now(timezone.utc) + timedelta(minutes=auth_utils.ACCESS_TOKEN_EXPIRE_MINUTES)
            db.commit()
            active.insert(0, current)

    out = []
    for s in active:
        d = schemas.SessionOut.model_validate(s)
        d.is_current = bool(current_token and s.session_token == current_token)
        out.append(d)
    return out


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Sign out one device (from the devices dashboard, or your own current device)."""
    session = db.query(models.UserSession).filter(
        models.UserSession.id == session_id,
        models.UserSession.user_id == current_user.id,
        models.UserSession.revoked_at.is_(None),
    ).first()
    if not session:
        raise HTTPException(404, "That device session was not found.")
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Device signed out."}


@router.post("/sessions/revoke-all", response_model=schemas.RevokeAllOut)
def revoke_all_sessions(
    request: Request,
    payload: schemas.RevokeAllIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """
    Sign out everywhere.  (AUTH-SPEC.md R5, §3.3)

    WHY THIS IS NOT N DELETE CALLS FROM THE BROWSER. The devices dashboard could
    loop over the list and revoke each id, and for the ordinary case — tidying
    up an old tablet — that would be fine. It is wrong for the one case this
    exists to serve: a customer who believes their account is compromised.

    Three reasons, all of which only bite in exactly that case. It is not
    atomic, so a session created between the list and the last DELETE survives.
    It races the sliding-session refresh in the frontend's api.ts, which can
    extend a session's expiry while the loop is walking past it. And a partial
    failure — the fourth call times out on a phone with two bars — leaves the
    customer looking at a UI that says they are safe when an attacker still
    holds a live token.

    One statement, one transaction. Either every session named here is revoked
    or none is.

    `except_current` defaults to true, which is what the button in the dashboard
    means: get everyone else out, leave me signed in. Passing false must also
    invalidate the caller's own token, so the response is the last thing that
    token is good for.
    """
    now = datetime.now(timezone.utc)
    current_token = _current_session_token(request)

    q = db.query(models.UserSession).filter(
        models.UserSession.user_id == current_user.id,
        models.UserSession.revoked_at.is_(None),
    )
    # Only exclude the current session when we can actually identify it. A token
    # with no `sid` claim (issued before device tracking) would otherwise make
    # `except_current` silently mean "revoke everything", which is the opposite
    # of what the caller asked for on the safer of the two options.
    if payload.except_current and current_token:
        q = q.filter(models.UserSession.session_token != current_token)

    revoked = q.update({models.UserSession.revoked_at: now}, synchronize_session=False)
    db.commit()

    return {"revoked": int(revoked or 0), "current_session_kept": bool(payload.except_current and current_token)}


@router.post("/logout")
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Revoke the session tied to the token being used right now."""
    token = _current_session_token(request)
    if token:
        session = db.query(models.UserSession).filter(
            models.UserSession.session_token == token,
            models.UserSession.user_id == current_user.id,
        ).first()
        if session and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    return {"message": "Signed out."}


@router.post("/sessions/evict-and-login", response_model=schemas.Token)
def evict_and_login(request: Request, payload: schemas.DeviceEvictLogin, db: Session = Depends(get_db)):
    """Complete a login that hit the device cap: revoke the chosen device,
    then create the new session — no need to re-enter a password/OTP."""
    # AUTH-SPEC R1: per-address budget, counted in the database so it
    # survives the restarts this instance does constantly.
    enforce_ip_limit(db, request, "evict-and-login", SESSION_SWAP)
    claims = auth_utils.decode_action_token(payload.pending_token, "device_evict")
    user = db.query(models.User).filter(models.User.id == claims.get("uid")).first()
    if not user:
        raise HTTPException(404, "Account not found.")

    session = db.query(models.UserSession).filter(
        models.UserSession.id == payload.session_id,
        models.UserSession.user_id == user.id,
        models.UserSession.revoked_at.is_(None),
    ).first()
    if not session:
        raise HTTPException(404, "That device session was not found — it may already be signed out.")
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()

    session_token = _create_session_or_409(db, user, request)
    token = auth_utils.create_access_token({"sub": user.id, "sid": session_token})
    return {"access_token": token, "token_type": "bearer", "user": user}
