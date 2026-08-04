import os, re, random, smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
import notifications
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

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
    """Send OTP via Gmail SMTP. Falls back to console log if not configured."""
    smtp_email = os.getenv("SMTP_EMAIL", "")
    smtp_pass  = os.getenv("SMTP_PASSWORD", "")
    if not smtp_email or not smtp_pass:
        print(f"[OTP] {purpose} OTP for {to_email}: {otp}")
        return
    try:
        msg = MIMEText(
            f"Your Vijey Textile {purpose} OTP is: {otp}\n\n"
            f"This OTP is valid for 10 minutes.\n"
            f"Do not share this OTP with anyone.\n\n"
            f"— Vijey Textile Team"
        )
        msg["Subject"] = f"Vijey Textile — {purpose} OTP: {otp}"
        msg["From"]    = smtp_email
        msg["To"]      = to_email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(smtp_email, smtp_pass)
            s.sendmail(smtp_email, to_email, msg.as_string())
    except Exception as e:
        print(f"[OTP Email Error] {e}")
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


# ── REGISTER ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=schemas.Token, status_code=201)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists. Please login.")

    phone = _normalize_phone(payload.phone)
    if db.query(models.User).filter(models.User.phone == phone).first():
        raise HTTPException(409, "This phone number is already registered.")

    user = models.User(
        full_name     = payload.full_name.strip(),
        email         = payload.email.lower(),
        phone         = phone,
        password_hash = auth_utils.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth_utils.create_access_token({"sub": user.id})
    # Send welcome email in background
    notifications.send_welcome_email(user.email, user.full_name)
    notifications.send_welcome_sms(user.phone, user.full_name)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── LOGIN (email OR phone) ────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = _find_user(db, payload.identifier)

    if not user or not auth_utils.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email/phone or password. Please check and try again.",
        )
    if not user.is_active:
        raise HTTPException(403, "Your account has been deactivated. Contact support.")

    token = auth_utils.create_access_token({"sub": user.id})
    notifications.send_login_notification_email(user.email, user.full_name)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── GET ME ────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
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
def forgot_password(payload: schemas.OTPRequest, db: Session = Depends(get_db)):
    identifier = payload.identifier.strip()
    user = _find_user(db, identifier)
    if not user:
        # Don't reveal if user exists — just return success
        return {"message": "If this account exists, an OTP has been sent."}

    # Use email as identifier for OTP
    otp = _create_otp(db, user.email, otp_type="reset")
    notifications.send_password_reset_otp_email(user.email, user.full_name, otp)

    return {
        "message": f"OTP sent to your registered email ({user.email[:3]}***). Valid for 10 minutes.",
        "email_hint": user.email[:3] + "***@" + user.email.split("@")[-1],
    }


# ── VERIFY OTP & RESET PASSWORD ───────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(payload: schemas.OTPVerify, db: Session = Depends(get_db)):
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
def send_login_otp(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    """Verify credentials then send a 6-digit OTP to the user's email."""
    user = _find_user(db, payload.identifier)
    if not user or not auth_utils.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email/phone or password. Please check and try again.",
        )
    if not user.is_active:
        raise HTTPException(403, "Your account has been deactivated. Contact support.")

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
def verify_login_otp(payload: schemas.LoginOTPVerify, db: Session = Depends(get_db)):
    """Verify the 6-digit OTP and return a JWT if correct."""
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

    token = auth_utils.create_access_token({"sub": user.id})
    notifications.send_login_notification_email(user.email, user.full_name)
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
    notifications.send_deletion_otp_email(current_user.email, current_user.full_name, otp)
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
