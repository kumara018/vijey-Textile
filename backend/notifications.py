"""
Vijey Textile — Email, SMS & WhatsApp Notifications
Sends all transactional emails (welcome, order, payment, status, OTPs)
and optional SMS via Twilio.

Env vars required:
  SMTP_EMAIL       — Gmail address
  SMTP_PASSWORD    — Gmail App Password (16 chars, no spaces)

Optional (SMS):
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE     — Twilio from-number (e.g. +14155551234)
"""

import os, smtplib, threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "")
SMTP_PASS     = os.getenv("SMTP_PASSWORD", "")
STORE_NAME    = "Vijey Textile"
STORE_URL     = os.getenv("FRONTEND_URL", "https://vijeytextile.com")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", SMTP_EMAIL or "kumaragurubaran27102@gmail.com")
STORE_ADDR    = "Shop Ground Floor No 131, Texvalley Gangapuram"
YEAR          = datetime.now().year


# ── Low-level send (runs in background thread so API never blocks) ─────────────
def _send_email(to: str, subject: str, html: str):
    """
    Tries SendGrid HTTP API first (works on Render — no port blocking).
    Falls back to Gmail SMTP only if SENDGRID_API_KEY is not set.
    """
    import json as _json, urllib.request as _req, urllib.error as _uerr

    sg_key = os.getenv("SENDGRID_API_KEY", "")

    # ── Path A: SendGrid (recommended on Render) ───────────────────────────────
    if sg_key:
        from_email = SMTP_EMAIL or "noreply@vijeytextile.com"
        # Plain-text version strips HTML tags for multipart — improves deliverability
        import re as _re
        plain = _re.sub(r'<[^>]+>', '', html)
        plain = _re.sub(r'\s{2,}', '\n', plain).strip()
        payload = _json.dumps({
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": from_email, "name": STORE_NAME},
            "reply_to": {"email": SUPPORT_EMAIL},
            "subject": subject,
            "content": [
                {"type": "text/plain", "value": plain},
                {"type": "text/html",  "value": html},
            ],
            # Unsubscribe header — required by Gmail to classify as "wanted" mail
            "headers": {
                "List-Unsubscribe": f"<mailto:{SUPPORT_EMAIL}?subject=Unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                "X-Mailer": "Vijey Textile Notifications",
            },
            "tracking_settings": {
                "click_tracking":      {"enable": False},
                "open_tracking":       {"enable": False},
                "subscription_tracking": {"enable": False},
            },
        }).encode()
        try:
            request = _req.Request(
                "https://api.sendgrid.com/v3/mail/send",
                data=payload,
                headers={
                    "Authorization": f"Bearer {sg_key}",
                    "Content-Type":  "application/json",
                },
            )
            with _req.urlopen(request, timeout=15) as resp:
                print(f"[Email SENT ✓ SendGrid {resp.status}] {subject} → {to}")
        except _uerr.HTTPError as e:
            body = e.read().decode(errors="ignore")
            print(f"[Email SendGrid HTTP {e.code}] {subject} → {to} | {body}")
        except Exception as e:
            print(f"[Email SendGrid ERROR] {type(e).__name__}: {e}")
        return  # never fall through to SMTP when API key is set

    # ── Path B: Gmail SMTP (blocked on Render free tier — local dev only) ──────
    if not SMTP_EMAIL or not SMTP_PASS:
        print(f"[Email SKIP — no SendGrid key and no SMTP config] {subject} → {to}")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"]  = subject
        msg["From"]     = f"{STORE_NAME} <{SMTP_EMAIL}>"
        msg["To"]       = to
        msg["Reply-To"] = SUPPORT_EMAIL
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            s.login(SMTP_EMAIL, SMTP_PASS)
            s.sendmail(SMTP_EMAIL, to, msg.as_string())
        print(f"[Email SENT ✓ SMTP] {subject} → {to}")
    except smtplib.SMTPAuthenticationError as e:
        print(f"[Email AUTH ERROR] Gmail rejected login. Check App Password. {e}")
    except smtplib.SMTPException as e:
        print(f"[Email SMTP ERROR] {e}")
    except Exception as e:
        print(f"[Email ERROR] {type(e).__name__}: {e}")

def _bg(to: str, subject: str, html: str):
    """Fire-and-forget email in a daemon thread."""
    threading.Thread(target=_send_email, args=(to, subject, html), daemon=True).start()


# ── HTML helpers ───────────────────────────────────────────────────────────────
# Shared brand header — pure HTML, no PNG image, renders perfectly in all clients
# Exact navbar colors from tailwind.config:
#   bg-brand-gradient = linear-gradient(135deg, #e11d48 0%, #9f1239 100%)
#   text-white        = #ffffff   (Vijey Textile brand name)
#   text-gold-300     = #fde047   (tagline — same as navbar tagline)
#   font-display      = Georgia   (same as Tailwind fontFamily.display)
#   logo image        = logo_vijey.png (Vijey Textile luxury logo, rose bg)
_HEADER_HTML = f"""\
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-collapse:collapse;
                  background:linear-gradient(135deg,#e11d48 0%,#9f1239 100%);">
      <tr>
        <td align="center" style="padding:16px 24px 14px;">
          <!-- Logo + brand -->
          <table cellpadding="0" cellspacing="0" border="0"
                 style="border-collapse:collapse;">
            <tr>
              <td valign="middle" style="padding-right:14px;font-size:0;line-height:0;">
                <img src="{STORE_URL}/logo_vijey.png"
                     width="120" height="40"
                     alt="Vijey Textile"
                     style="display:block;border:0;width:120px;height:40px;" />
              </td>
              <td valign="middle" style="text-align:left;">
                <p style="margin:0 0 3px 0;padding:0;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:10px;color:#fde047;letter-spacing:3px;
                          text-transform:uppercase;line-height:1.4;
                          mso-line-height-rule:exactly;">
                  Luxury Girls&#8217; &amp; Baby Fashion
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>"""


def _wrap(body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px 16px;background:#fff1f2;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;
              overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

{_HEADER_HTML}

    <!-- Body -->
    <div style="padding:32px;">{body}</div>

    <!-- Footer -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-collapse:collapse;background:#f8f4f0;border-top:1px solid #ede8e3;">
      <tr>
        <td align="center" style="padding:18px 24px;">
          <p style="margin:0 0 6px;color:#888;font-size:12px;
                    font-family:Arial,sans-serif;">{STORE_ADDR}</p>
          <p style="margin:0 0 6px;font-size:12px;font-family:Arial,sans-serif;">
            <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;text-decoration:none;">Contact Support</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}" style="color:#e11d48;text-decoration:none;">Visit Store</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}/orders" style="color:#e11d48;text-decoration:none;">My Orders</a>
          </p>
          <p style="margin:0;color:#bbb;font-size:11px;font-family:Arial,sans-serif;">
            &copy; {YEAR} {STORE_NAME}. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>"""

def _btn(text: str, url: str, bg: str = "#e11d48") -> str:
    return (f'<div style="text-align:center;margin:28px 0;">'
            f'<a href="{url}" style="display:inline-block;background:{bg};color:#ffffff;'
            f'padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;'
            f'font-size:15px;letter-spacing:0.3px;">{text}</a></div>')


# ── 1. Welcome email (sent on registration) ────────────────────────────────────
def send_welcome_email(email: str, name: str):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">Welcome to {STORE_NAME}, {first}! 🎉</h2>
      <p style="color:#444;line-height:1.7;font-size:15px;">
        Thank you for creating your account. We're delighted to have you as part of the
        <strong>{STORE_NAME}</strong> family!
      </p>
      <p style="color:#444;line-height:1.7;font-size:15px;">Discover our exclusive collection:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:12px 8px;text-align:center;background:#fff1f2;border-radius:8px;width:30%;">
            <div style="font-size:30px;">👗</div>
            <div style="color:#e11d48;font-weight:bold;font-size:13px;margin-top:6px;">Chudithar &amp; Tops</div>
          </td>
          <td style="width:4%;"></td>
          <td style="padding:12px 8px;text-align:center;background:#fff1f2;border-radius:8px;width:30%;">
            <div style="font-size:30px;">🪭</div>
            <div style="color:#e11d48;font-weight:bold;font-size:13px;margin-top:6px;">Lehenga &amp; Half Sarees</div>
          </td>
          <td style="width:4%;"></td>
          <td style="padding:12px 8px;text-align:center;background:#fff1f2;border-radius:8px;width:30%;">
            <div style="font-size:30px;">✨</div>
            <div style="color:#e11d48;font-weight:bold;font-size:13px;margin-top:6px;">Party Wears</div>
          </td>
        </tr>
      </table>
      {_btn("Start Shopping →", STORE_URL)}
      <hr style="border:none;border-top:1px solid #ede8e3;margin:24px 0;">
      <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
        Questions? Email us at
        <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a> — we reply within 24 hours.
      </p>
    """)
    _bg(email, f"Welcome to {STORE_NAME}! 🎉 Your account is ready", html)


# ── 2. Order confirmation ──────────────────────────────────────────────────────
def send_order_confirmation_email(email: str, name: str, order):
    first = name.split()[0]
    rows = "".join(f"""
      <tr>
        <td style="padding:10px 0;color:#444;border-bottom:1px solid #f0ebe5;font-size:14px;">{i.get('name','')}</td>
        <td style="padding:10px 0;color:#666;border-bottom:1px solid #f0ebe5;font-size:14px;text-align:center;">×{i.get('quantity',1)}</td>
        <td style="padding:10px 0;color:#444;border-bottom:1px solid #f0ebe5;font-size:14px;text-align:right;font-weight:bold;">₹{i.get('price',0):,.0f}</td>
      </tr>""" for i in (order.items_snapshot or []))

    addr = order.shipping_address or {}
    addr2 = (", " + addr.get("address_line2", "")) if addr.get("address_line2") else ""
    html = _wrap(f"""
      <div style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 20px;margin-bottom:20px;">
        <span style="color:#15803d;font-weight:bold;font-size:14px;">✅ Order Confirmed</span>
      </div>
      <h2 style="color:#1e293b;margin-top:0;font-size:21px;">Hi {first}, your order is placed!</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">We've received your order and our team is getting it ready for you.</p>

      <div style="background:#f8f4f0;border-left:4px solid #e11d48;border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#888;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Order Number</p>
        <p style="margin:6px 0 0;font-size:22px;font-weight:bold;color:#e11d48;letter-spacing:2px;">{order.order_number}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px 0;color:#888;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e0db;">Product</th>
            <th style="text-align:center;padding:10px 0;color:#888;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e0db;">Qty</th>
            <th style="text-align:right;padding:10px 0;color:#888;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e0db;">Price</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>

      <div style="background:#f8f4f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;color:#666;font-size:14px;">Subtotal &nbsp;<strong style="color:#444;float:right;">₹{order.subtotal:,.0f}</strong></p>
        <p style="margin:0 0 6px;color:#666;font-size:14px;">Shipping &nbsp;<strong style="color:#16a34a;float:right;">{"FREE" if order.shipping_fee == 0 else f"₹{order.shipping_fee:,.0f}"}</strong></p>
        <hr style="border:none;border-top:1px solid #ddd;margin:10px 0;">
        <p style="margin:0;color:#1e293b;font-weight:bold;font-size:16px;">Total &nbsp;<strong style="color:#e11d48;font-size:18px;float:right;">₹{order.total:,.0f}</strong></p>
      </div>

      <div style="margin:20px 0;">
        <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Delivering to</p>
        <p style="color:#444;font-size:14px;margin:0;line-height:1.8;">
          <strong>{addr.get('full_name','')}</strong><br>
          {addr.get('address_line1','')}{addr2}<br>
          {addr.get('city','')}, {addr.get('state','')} — {addr.get('pincode','')}<br>
          📞 {addr.get('phone','')}
        </p>
      </div>
      {_btn("Track Your Order →", f"{STORE_URL}/orders/{order.id}")}
    """)
    _bg(email, f"Order Confirmed — {order.order_number} | {STORE_NAME}", html)


# ── 3. Payment success ─────────────────────────────────────────────────────────
def send_payment_success_email(email: str, name: str, order):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#16a34a;margin-top:0;font-size:22px;">💚 Payment Successful!</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, your payment of <strong style="color:#e11d48;">₹{order.total:,.0f}</strong>
        for order <strong>{order.order_number}</strong> has been received.
      </p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:#15803d;font-size:16px;font-weight:bold;">✅ Payment Confirmed</p>
        <p style="margin:8px 0 0;color:#166534;font-size:13px;">Your order is being prepared and will be shipped soon.</p>
      </div>
      <table style="width:100%;font-size:14px;margin:16px 0;">
        <tr><td style="color:#888;padding:6px 0;">Payment Method</td><td style="color:#444;font-weight:bold;text-align:right;">{order.payment_method.upper()}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Amount Paid</td><td style="color:#e11d48;font-weight:bold;text-align:right;">₹{order.total:,.0f}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Order Number</td><td style="color:#444;font-weight:bold;text-align:right;">{order.order_number}</td></tr>
        {f'<tr><td style="color:#888;padding:6px 0;">Transaction ID</td><td style="color:#444;font-weight:bold;text-align:right;font-family:monospace;font-size:12px;">{order.payment_transaction_id}</td></tr>' if getattr(order, "payment_transaction_id", None) else ""}
      </table>
      {_btn("View Order Details →", f"{STORE_URL}/orders/{order.id}")}
    """)
    _bg(email, f"Payment Successful ₹{order.total:,.0f} — {order.order_number} | {STORE_NAME}", html)


# ── 4. Payment failed ──────────────────────────────────────────────────────────
def send_payment_failed_email(email: str, name: str, order):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#dc2626;margin-top:0;font-size:22px;">❌ Payment Failed</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, we couldn't process your payment for order <strong>{order.order_number}</strong>.
      </p>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;margin:20px 0;">
        <p style="margin:0;color:#dc2626;font-weight:bold;">❌ Order cancelled — no amount has been deducted.</p>
        <p style="margin:8px 0 0;color:#991b1b;font-size:13px;">Please try again with a different payment method.</p>
      </div>
      {_btn("Try Again →", STORE_URL, "#dc2626")}
      <p style="color:#888;font-size:13px;margin-top:20px;">
        If you were charged, contact us at
        <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a>.
      </p>
    """)
    _bg(email, f"Payment Failed — Order {order.order_number} | {STORE_NAME}", html)


# ── 5. Order status update ─────────────────────────────────────────────────────
_STATUS_MAP = {
    "processing":       ("🔄 Order Being Processed",   "#2563eb", "#eff6ff", "Your order is being prepared by our team."),
    "shipped":          ("📦 Your Order is Shipped!",   "#e11d48", "#fff1f2", "Your order is on its way — expect it soon!"),
    "out_for_delivery": ("🚚 Out for Delivery Today!",  "#ea580c", "#fff7ed", "Your order is out for delivery — stay at home!"),
    "delivered":        ("✅ Order Delivered!",          "#16a34a", "#f0fdf4", "Your order has been delivered. We hope you love it!"),
    "cancelled":        ("❌ Order Cancelled",            "#dc2626", "#fef2f2", "Your order has been cancelled."),
}

def send_order_status_email(email: str, name: str, order, new_status: str):
    first = name.split()[0]
    title, color, bg, msg = _STATUS_MAP.get(
        new_status, (f"Order Update: {new_status.title()}", "#e11d48", "#f8f4f0", f"Status: {new_status}")
    )
    tracking = (f'<p style="color:#444;font-size:14px;margin-top:12px;">'
                f'Tracking Number: <strong>{order.tracking_number}</strong></p>'
                if getattr(order, "tracking_number", None) else "")
    html = _wrap(f"""
      <h2 style="color:{color};margin-top:0;font-size:22px;">{title}</h2>
      <p style="color:#444;font-size:14px;">
        Hi {first}, here's an update on your order <strong>{order.order_number}</strong>.
      </p>
      <div style="background:{bg};border-left:4px solid {color};border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:{color};font-weight:bold;font-size:14px;">{msg}</p>
      </div>
      {tracking}
      {_btn("Track Your Order →", f"{STORE_URL}/orders/{order.id}")}
    """)
    _bg(email, f"{title} — {order.order_number} | {STORE_NAME}", html)


# ── 6. Review request (after delivery) ────────────────────────────────────────
def send_review_request_email(email: str, name: str, order):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">How did we do? ⭐</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, we hope you're loving your purchase from order <strong>{order.order_number}</strong>!
      </p>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Your review helps other shoppers find the right product and helps us improve.
        It takes less than 2 minutes!
      </p>
      {_btn("⭐ Write a Review", f"{STORE_URL}/orders/{order.id}", "#f5c842")}
      <p style="color:#888;font-size:12px;text-align:center;margin-top:8px;">
        Click above to rate and review your purchase.
      </p>
    """)
    _bg(email, f"How was your order? Share your feedback | {STORE_NAME}", html)


# ── 7. Account deletion OTP ────────────────────────────────────────────────────
def send_deletion_otp_email(email: str, name: str, otp: str):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#dc2626;margin-top:0;font-size:22px;">⚠️ Account Deletion Request</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, we received a request to permanently delete your <strong>{STORE_NAME}</strong> account.
      </p>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:24px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Your Deletion OTP</p>
        <p style="margin:12px 0 4px;font-size:40px;font-weight:bold;color:#dc2626;letter-spacing:10px;font-family:monospace;">{otp}</p>
        <p style="margin:0;color:#888;font-size:12px;">Valid for 10 minutes only</p>
      </div>
      <div style="background:#fff8e1;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-weight:bold;font-size:14px;">
          ⏳ Your account will be permanently deleted after 24 hours.
        </p>
        <p style="margin:8px 0 0;color:#92400e;font-size:13px;">
          To cancel: simply log in to your account within 24 hours.
        </p>
      </div>
      <p style="color:#888;font-size:13px;">
        If you did NOT request this, ignore this email — your account remains safe.
      </p>
    """)
    _bg(email, f"Confirm account deletion — {STORE_NAME}", html)


# ── 8. Deletion scheduled (4-hour countdown) ──────────────────────────────────
DELETE_HOURS = 4   # single source of truth — change here to adjust the window

def send_deletion_scheduled_email(email: str, name: str, delete_at):
    first = name.split()[0]
    # Format in IST (UTC+5:30)
    from datetime import timezone, timedelta as _td
    ist = timezone(_td(hours=5, minutes=30))
    delete_str = delete_at.astimezone(ist).strftime("%d %B %Y at %I:%M %p IST")
    retrieve_url = f"{STORE_URL}/auth/login"
    html = _wrap(f"""
      <!-- Warning badge -->
      <div style="display:inline-block;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 20px;margin-bottom:20px;">
        <span style="color:#dc2626;font-weight:bold;font-size:14px;">⚠️ Account Deletion Initiated</span>
      </div>

      <h2 style="color:#1e293b;margin-top:0;font-size:22px;">Hi {first}, your account deletion is scheduled</h2>

      <p style="color:#444;font-size:14px;line-height:1.7;">
        We've received your request to permanently delete your <strong>{STORE_NAME}</strong> account.
        Your account will be <strong style="color:#dc2626;">permanently deleted in {DELETE_HOURS} hours</strong>.
      </p>

      <!-- Countdown box -->
      <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Account will be permanently deleted at</p>
        <p style="margin:12px 0 4px;font-size:22px;font-weight:bold;color:#dc2626;">{delete_str}</p>
        <p style="margin:8px 0 0;color:#991b1b;font-size:13px;">All your orders, addresses and data will be erased</p>
      </div>

      <!-- Retrieve CTA (prominent green box) -->
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:#15803d;font-weight:bold;font-size:15px;">🛡️ Changed your mind?</p>
        <p style="margin:8px 0 16px;color:#166534;font-size:13px;line-height:1.6;">
          Simply <strong>log in to your account</strong> within the next {DELETE_HOURS} hours.<br>
          Your account will be instantly restored — no action needed.
        </p>
        {_btn("🔓 Retrieve My Account →", retrieve_url, "#16a34a")}
      </div>

      <hr style="border:none;border-top:1px solid #ede8e3;margin:24px 0;">
      <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
        If you did NOT request this, your account may be at risk. Please
        <a href="{retrieve_url}" style="color:#e11d48;">log in immediately</a> to secure it,
        or contact <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a>.
      </p>
    """)
    _bg(email, f"⚠️ Your {STORE_NAME} account will be deleted in {DELETE_HOURS} hours", html)


# ── 8b. Account permanently deleted ───────────────────────────────────────────
def send_account_permanently_deleted_email(email: str, name: str):
    first = name.split()[0]
    html = _wrap(f"""
      <div style="display:inline-block;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 20px;margin-bottom:20px;">
        <span style="color:#dc2626;font-weight:bold;font-size:14px;">❌ Account Permanently Deleted</span>
      </div>

      <h2 style="color:#1e293b;margin-top:0;font-size:22px;">Hi {first}, your account has been deleted</h2>

      <p style="color:#444;font-size:14px;line-height:1.7;">
        Your <strong>{STORE_NAME}</strong> account and all associated data have been
        <strong style="color:#dc2626;">permanently deleted</strong> as requested.
      </p>

      <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.8;">
          The following data has been removed:<br>
          • Your profile, email and phone number<br>
          • All saved addresses<br>
          • Order history and invoices<br>
          • Cart and wishlist items
        </p>
      </div>

      <div style="background:#f8f4f0;border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:#555;font-size:14px;">
          You can always create a new account at
          <a href="{STORE_URL}" style="color:#e11d48;font-weight:bold;">{STORE_URL}</a>
        </p>
      </div>

      <hr style="border:none;border-top:1px solid #ede8e3;margin:24px 0;">
      <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
        If you believe this was a mistake, contact us immediately at
        <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a>.
        We may be able to assist within 24 hours of deletion.
      </p>
    """)
    _bg(email, f"Your {STORE_NAME} account has been permanently deleted", html)


# ── 8c. Account retrieved / deletion cancelled ─────────────────────────────────
def send_account_retrieved_email(email: str, name: str):
    first = name.split()[0]
    html = _wrap(f"""
      <div style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 20px;margin-bottom:20px;">
        <span style="color:#15803d;font-weight:bold;font-size:14px;">✅ Account Successfully Restored</span>
      </div>

      <h2 style="color:#1e293b;margin-top:0;font-size:22px;">Welcome back, {first}! 🎉 Your account is safe</h2>

      <p style="color:#444;font-size:14px;line-height:1.7;">
        Your <strong>{STORE_NAME}</strong> account deletion has been <strong style="color:#15803d;">cancelled</strong>.
        Everything is exactly as you left it — your orders, addresses and data are safe.
      </p>

      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:28px;">🛡️</p>
        <p style="margin:10px 0 4px;color:#15803d;font-weight:bold;font-size:16px;">Your Account is Active</p>
        <p style="margin:0;color:#166534;font-size:13px;">No data has been removed. All your information is intact.</p>
      </div>

      {_btn("Continue Shopping →", STORE_URL)}

      <hr style="border:none;border-top:1px solid #ede8e3;margin:24px 0;">
      <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
        If you did not cancel this deletion yourself, please change your password immediately
        or contact <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a>.
      </p>
    """)
    _bg(email, f"✅ Your {STORE_NAME} account has been restored", html)


# ── 9. Login OTP email ────────────────────────────────────────────────────────
def send_login_otp_email(email: str, name: str, otp: str):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">🔐 Your Login OTP</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, use the OTP below to complete your sign-in to <strong>{STORE_NAME}</strong>.
      </p>
      <div style="background:#fff1f2;border:2px solid #e11d48;border-radius:12px;padding:28px;margin:24px 0;text-align:center;">
        <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:3px;">One-Time Password</p>
        <p style="margin:14px 0 6px;font-size:46px;font-weight:bold;color:#e11d48;letter-spacing:14px;font-family:monospace;">{otp}</p>
        <p style="margin:0;color:#999;font-size:12px;">Valid for <strong>10 minutes</strong> only</p>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
          🛡️ <strong>Security tip:</strong> Never share this OTP with anyone.
          Vijey Textile staff will never ask for your OTP.
        </p>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.6;">
        Didn't request this? Someone may have tried to sign in with your account.
        You can safely ignore this email — your account is secure.
      </p>
    """)
    _bg(email, f"Your Vijey Textile sign-in code", html)


# ── 10. Password reset OTP email ──────────────────────────────────────────────
def send_password_reset_otp_email(email: str, name: str, otp: str):
    first = name.split()[0]
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">🔑 Password Reset OTP</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, we received a request to reset your <strong>{STORE_NAME}</strong> password.
        Use the OTP below to continue.
      </p>
      <div style="background:#fff1f2;border:2px solid #e11d48;border-radius:12px;padding:28px;margin:24px 0;text-align:center;">
        <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:3px;">Password Reset OTP</p>
        <p style="margin:14px 0 6px;font-size:46px;font-weight:bold;color:#e11d48;letter-spacing:14px;font-family:monospace;">{otp}</p>
        <p style="margin:0;color:#999;font-size:12px;">Valid for <strong>10 minutes</strong> only</p>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
          🛡️ <strong>Security tip:</strong> Never share this OTP with anyone.
          If you did NOT request a password reset, please ignore this email.
        </p>
      </div>
      {_btn("Go to Reset Password →", f"{STORE_URL}/auth/forgot-password")}
    """)
    _bg(email, f"Reset your Vijey Textile password", html)


# ── helpers ───────────────────────────────────────────────────────────────────
_EMOJI_MAP = {
    "Lehenga": "👗", "Chudithar": "👘", "Half Saree": "🥻",
    "Crop Tops": "🎽", "Tops": "👕", "Party Wears": "✨",
}

def _cart_summary_html(cart_items: list) -> str:
    """Build an HTML table of all items currently in the cart."""
    if not cart_items:
        return "<p style='color:#888;font-size:13px;text-align:center;'>Your cart is now empty.</p>"
    rows = ""
    total_qty   = 0
    total_price = 0.0
    for item in cart_items:
        emoji    = _EMOJI_MAP.get(item.get("category", ""), "🛍️")
        name     = item.get("name", "")
        qty      = item.get("quantity", 1)
        price    = item.get("price", 0)
        subtotal = price * qty
        size_color = ""
        if item.get("size"):  size_color += f"Size: {item['size']}"
        if item.get("color"): size_color += (" · " if size_color else "") + f"Colour: {item['color']}"
        total_qty   += qty
        total_price += subtotal
        rows += f"""
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #f0ebe5;font-size:14px;">
            <span style="font-size:18px;">{emoji}</span>
            <span style="margin-left:8px;font-weight:600;color:#1e293b;">{name}</span>
            {f'<br><span style="font-size:11px;color:#888;margin-left:26px;">{size_color}</span>' if size_color else ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #f0ebe5;text-align:center;color:#555;font-size:14px;">×{qty}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f0ebe5;text-align:right;font-weight:bold;color:#e11d48;font-size:14px;">₹{subtotal:,.0f}</td>
        </tr>"""
    return f"""
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#fff1f2;">
          <th style="text-align:left;padding:10px 8px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Product</th>
          <th style="text-align:center;padding:10px 8px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Qty</th>
          <th style="text-align:right;padding:10px 8px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Price</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px 8px;font-weight:bold;color:#444;font-size:14px;">
            {total_qty} item{"s" if total_qty != 1 else ""} in cart
          </td>
          <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#e11d48;font-size:16px;">
            ₹{total_price:,.0f}
          </td>
        </tr>
      </tfoot>
    </table>"""

def _cart_sms(cart_items: list) -> str:
    """One-line SMS summary of the cart."""
    if not cart_items:
        return "Your cart is now empty."
    parts = [f"{item.get('name','Item')} x{item.get('quantity',1)}" for item in cart_items[:3]]
    suffix = f" +{len(cart_items)-3} more" if len(cart_items) > 3 else ""
    total  = sum(item.get("price", 0) * item.get("quantity", 1) for item in cart_items)
    return f"Cart ({len(cart_items)} item{'s' if len(cart_items)!=1 else ''}): {', '.join(parts)}{suffix}. Total ₹{total:,.0f}"


# ── 11a. Cart — item ADDED ────────────────────────────────────────────────────
def send_cart_add_email(email: str, name: str, product_name: str,
                        product_category: str, quantity: int,
                        size: str, color: str, cart_items: list):
    first = name.split()[0]
    emoji   = _EMOJI_MAP.get(product_category, "🛍️")
    details = []
    if size:  details.append(f"Size: <strong>{size}</strong>")
    if color: details.append(f"Colour: <strong>{color}</strong>")
    details_line = " &nbsp;·&nbsp; ".join(details)
    summary_html = _cart_summary_html(cart_items)
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">🛒 Added to your cart!</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, <strong>{product_name}</strong> (×{quantity}) has been added to your cart.
      </p>

      <!-- Added product highlight -->
      <div style="background:#fff1f2;border:2px solid #f97316;border-radius:12px;padding:20px;margin:20px 0;display:flex;align-items:center;gap:16px;">
        <div style="font-size:52px;flex-shrink:0;">{emoji}</div>
        <div>
          <p style="margin:0;font-size:16px;font-weight:bold;color:#e11d48;">{product_name}</p>
          <p style="margin:4px 0 0;color:#888;font-size:13px;">Quantity: {quantity}</p>
          {f'<p style="margin:4px 0 0;color:#888;font-size:12px;">{details_line}</p>' if details_line else ''}
        </div>
      </div>

      <!-- Full cart summary -->
      <p style="color:#e11d48;font-weight:bold;font-size:15px;margin-bottom:4px;">🧺 Your Cart Summary</p>
      {summary_html}

      <!-- Urgency nudge -->
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
          ⚡ <strong>Stock is limited!</strong> Complete your order before someone else grabs it.
        </p>
      </div>
      {_btn("Go to Cart & Order →", f"{STORE_URL}/cart", "#f97316")}
    """)
    _bg(email, f"Added to cart: {product_name} | {STORE_NAME}", html)


# ── 11b. Cart — item REMOVED ──────────────────────────────────────────────────
def send_cart_remove_email(email: str, name: str, product_name: str,
                           product_category: str, cart_items: list):
    first     = name.split()[0]
    emoji     = _EMOJI_MAP.get(product_category, "🛍️")
    summary_html = _cart_summary_html(cart_items)
    remaining = len(cart_items)
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">🗑️ Item removed from cart</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, <strong>{product_name}</strong> has been removed from your cart.
      </p>

      <!-- Removed product -->
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:16px;margin:20px 0;display:flex;align-items:center;gap:12px;">
        <div style="font-size:40px;flex-shrink:0;opacity:0.5;">{emoji}</div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:bold;color:#991b1b;text-decoration:line-through;">{product_name}</p>
          <p style="margin:4px 0 0;color:#dc2626;font-size:12px;">Removed from cart</p>
        </div>
      </div>

      <!-- Remaining cart -->
      {f'<p style="color:#e11d48;font-weight:bold;font-size:15px;margin-bottom:4px;">🧺 Remaining Cart ({remaining} item{"s" if remaining!=1 else ""})</p>' if remaining > 0 else ''}
      {summary_html}

      {_btn("Continue Shopping →", f"{STORE_URL}/products", "#e11d48") if remaining == 0 else _btn("View Cart & Order →", f"{STORE_URL}/cart", "#f97316")}
    """)
    _bg(email, f"Item removed from cart | {STORE_NAME}", html)


# ── 11c. Cart SMS notifications ────────────────────────────────────────────────
def send_cart_add_sms(phone: str, product_name: str, quantity: int, cart_items: list):
    summary = _cart_sms(cart_items)
    _send_sms(phone,
        f"{STORE_NAME}: Added '{product_name}' x{quantity} to cart. {summary} Order: {STORE_URL}/cart"
    )

def send_cart_remove_sms(phone: str, product_name: str, cart_items: list):
    summary = _cart_sms(cart_items)
    _send_sms(phone,
        f"{STORE_NAME}: Removed '{product_name}' from cart. {summary} Shop: {STORE_URL}"
    )


# ── 11d. Keep old function name as alias (backward compat) ────────────────────
def send_cart_reminder_email(email: str, name: str, product_name: str, product_image_emoji: str = "🛍️"):
    """Legacy alias — prefer send_cart_add_email for full cart summary."""
    send_cart_add_email(email, name, product_name, "", 1, "", "", [])


# ── 12. Delivery OTP email ─────────────────────────────────────────────────────
def send_delivery_otp_email(email: str, name: str, otp: str, order_number: str,
                             agent_name: str = "", agent_phone: str = ""):
    first = name.split()[0]
    agent_block = ""
    if agent_name or agent_phone:
        agent_block = f"""
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#0369a1;font-weight:bold;font-size:14px;">📦 Your Delivery Agent</p>
        {"<p style='margin:8px 0 0;color:#0c4a6e;font-size:14px;'>👤 " + agent_name + "</p>" if agent_name else ""}
        {"<p style='margin:6px 0 0;color:#0c4a6e;font-size:14px;'>📞 " + agent_phone + "</p>" if agent_phone else ""}
      </div>"""
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">🚚 Your order is out for delivery!</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, your order <strong>{order_number}</strong> is on its way and will be delivered today!
      </p>
      {agent_block}
      <div style="background:#fff1f2;border:2px solid #e11d48;border-radius:12px;padding:28px;margin:24px 0;text-align:center;">
        <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:3px;">Your Delivery OTP</p>
        <p style="margin:14px 0 6px;font-size:52px;font-weight:bold;color:#e11d48;letter-spacing:14px;font-family:monospace;">{otp}</p>
        <p style="margin:0;color:#666;font-size:13px;">Share this OTP with the delivery agent to confirm receipt</p>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-weight:bold;font-size:14px;">⚠️ Important Security Note</p>
        <p style="margin:8px 0 0;color:#92400e;font-size:13px;line-height:1.6;">
          • Only share this OTP with the delivery person at your door<br>
          • Do NOT share via phone call or message<br>
          • The OTP confirms you received the package
        </p>
      </div>
      {_btn("Track Your Order →", f"{STORE_URL}/orders")}
    """)
    _bg(email, f"🚚 Delivery OTP for order {order_number} — share with delivery agent | {STORE_NAME}", html)


# ── 13. Support rating confirmation (to user) ─────────────────────────────────
def send_support_rating_confirmation(email: str, name: str, rating: int):
    first = name.split()[0]
    stars = "⭐" * rating
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">Thank you for your feedback! 🙏</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, we truly appreciate you taking the time to rate your experience with our support team.
      </p>
      <div style="background:#fff1f2;border:2px solid #e11d48;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:36px;">{stars}</p>
        <p style="margin:10px 0 0;color:#e11d48;font-weight:bold;font-size:16px;">You rated us {rating}/5</p>
      </div>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Your feedback helps our support team grow and serve you better. If you have any unresolved issues,
        please don't hesitate to reach out — we're always here to help.
      </p>
      {_btn("Visit Our Store →", STORE_URL)}
    """)
    _bg(email, f"Thank you for rating Vijey Textile Support — {STORE_NAME}", html)


# ── 14. Support rating admin notification ──────────────────────────────────────
def send_support_rating_admin_notify(name: str, email: str, rating: int, category: str, message: str):
    admin_email = os.getenv("ADMIN_EMAIL", SMTP_EMAIL or SUPPORT_EMAIL)
    if not admin_email:
        return
    stars = "⭐" * rating + "☆" * (5 - rating)
    color = "#16a34a" if rating >= 4 else "#ea580c" if rating == 3 else "#dc2626"
    category_row = (
        f"<tr><td style='color:#888;padding:6px 0;'>Category</td><td style='color:#444;'>{category}</td></tr>"
        if category else ""
    )
    message_block = (
        f"<div style='background:#f8f4f0;border-radius:8px;padding:16px;margin:16px 0;'>"
        f"<p style='margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;'>Customer Comment</p>"
        f"<p style='margin:8px 0 0;color:#444;font-size:14px;line-height:1.6;'>{message}</p></div>"
        if message else ""
    )
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">📊 New Support Rating Received</h2>
      <div style="background:#f8f4f0;border-left:4px solid {color};border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0;font-size:28px;">{stars}</p>
        <p style="margin:8px 0 0;font-size:22px;font-weight:bold;color:{color};">{rating}/5 Stars</p>
      </div>
      <table style="width:100%;font-size:14px;margin:16px 0;">
        <tr><td style="color:#888;padding:6px 0;width:120px;">Customer</td><td style="color:#444;font-weight:bold;">{name}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Email</td><td style="color:#444;">{email}</td></tr>
        {category_row}
      </table>
      {message_block}
      <p style="color:#888;font-size:13px;">View all ratings in the Admin Dashboard → Support Ratings tab.</p>
    """)
    _bg(admin_email, f"New {rating}★ Support Rating from {name} — {STORE_NAME}", html)


# ══════════════════════════════════════════════════════════════════════════════
# ── 15. SMS & WhatsApp via Twilio ──────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def _normalize_phone(phone: str) -> str:
    """Ensure phone has +91 prefix for Indian numbers."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+91" + phone
    return phone


def _twilio_client():
    """Return (client, sms_from, wa_from) or None if not configured."""
    sid   = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN",  "").strip()
    if not sid or not token:
        return None, "", ""
    try:
        from twilio.rest import Client
        client   = Client(sid, token)
        sms_from = os.getenv("TWILIO_PHONE", "").strip()
        wa_from  = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886").strip()
        return client, sms_from, wa_from
    except Exception as e:
        print(f"[Twilio init error] {e}")
        return None, "", ""


def _send_sms(to_phone: str, message: str):
    """Send SMS. Logs to console if Twilio not configured."""
    to_phone = _normalize_phone(to_phone)
    client, sms_from, _ = _twilio_client()
    if not client or not sms_from:
        print(f"[SMS not configured] {to_phone}: {message}")
        return
    try:
        msg = client.messages.create(body=message, from_=sms_from, to=to_phone)
        print(f"[SMS SENT ✓ {msg.sid}] → {to_phone}")
    except Exception as e:
        print(f"[SMS ERROR] {type(e).__name__}: {e}")


def _send_whatsapp(to_phone: str, message: str):
    """Send WhatsApp message via Twilio. Runs in a daemon thread."""
    _brand = f"\n\n━━━━━━━━━━━━━━━\n👑 *Vijey Textile* — Premium Girls' & Baby Fashion\n🌐 {STORE_URL}"
    def _do():
        to = "whatsapp:" + _normalize_phone(to_phone)
        client, _, wa_from = _twilio_client()
        if not client or not wa_from:
            print(f"[WhatsApp not configured] {to}: {message[:80]}")
            return
        try:
            msg = client.messages.create(body=message + _brand, from_=wa_from, to=to)
            print(f"[WhatsApp SENT ✓ {msg.sid}] → {to}")
        except Exception as e:
            print(f"[WhatsApp ERROR] {type(e).__name__}: {e}")
    threading.Thread(target=_do, daemon=True).start()


def _bg_sms(to_phone: str, message: str):
    """Fire-and-forget SMS in a daemon thread."""
    threading.Thread(target=_send_sms, args=(to_phone, message), daemon=True).start()


# ── Cart text summary (for SMS/WhatsApp) ──────────────────────────────────────
def _cart_text(cart_items: list) -> str:
    if not cart_items:
        return "Your cart is empty."
    lines = []
    total = 0.0
    for item in cart_items:
        qty      = item.get("quantity", 1)
        price    = item.get("price", 0)
        subtotal = price * qty
        total   += subtotal
        size_color = ""
        if item.get("size"):  size_color += f" [{item['size']}"
        if item.get("color"): size_color += ("|" if item.get("size") else " [") + item["color"]
        if size_color:        size_color += "]"
        lines.append(f"  • {item.get('name','Item')}{size_color} ×{qty} — ₹{subtotal:,.0f}")
    lines.append(f"\n  *Total: ₹{total:,.0f} ({len(cart_items)} item{'s' if len(cart_items)!=1 else ''})*")
    return "\n".join(lines)


# ── 15a. Welcome ──────────────────────────────────────────────────────────────
def send_welcome_sms(phone: str, name: str):
    first = name.split()[0]
    _bg_sms(phone,
        f"🎉 Welcome to {STORE_NAME}, {first}!\n"
        f"Your account is ready. Start shopping at:\n{STORE_URL}"
    )
    _send_whatsapp(phone,
        f"🎉 *Welcome to {STORE_NAME}, {first}!*\n\n"
        f"Thank you for creating your account. Discover our exclusive collection of "
        f"Baby Frocks, Western Dresses, Frocks, Lehenga & Party Wears.\n\n"
        f"🛍️ Shop now: {STORE_URL}\n"
        f"📞 Support: {SUPPORT_EMAIL}"
    )


# ── 15b. OTP ──────────────────────────────────────────────────────────────────
def send_otp_sms(phone: str, otp: str, purpose: str = "Login"):
    _bg_sms(phone,
        f"{STORE_NAME} {purpose} OTP: *{otp}*\nValid 10 min. Do NOT share with anyone."
    )
    _send_whatsapp(phone,
        f"🔐 *{STORE_NAME} — {purpose} OTP*\n\n"
        f"Your one-time password is:\n\n"
        f"*{otp}*\n\n"
        f"⏱️ Valid for 10 minutes only.\n"
        f"🛡️ Never share this OTP with anyone. {STORE_NAME} staff will never ask for it."
    )


# ── 15c. Order confirmed ──────────────────────────────────────────────────────
def send_order_sms(phone: str, order_number: str, total: float):
    _bg_sms(phone,
        f"✅ {STORE_NAME}: Order {order_number} confirmed! "
        f"Total ₹{total:,.0f}. Track: {STORE_URL}/orders"
    )

def send_order_whatsapp(phone: str, name: str, order, items_snapshot: list):
    first = name.split()[0]
    rows  = "\n".join(
        f"  • {i.get('name','')} ×{i.get('quantity',1)} — ₹{i.get('price',0)*i.get('quantity',1):,.0f}"
        for i in items_snapshot
    )
    addr = order.shipping_address or {}
    txn_line = (f"\n🔐 Txn ID: `{order.payment_transaction_id}`"
                if getattr(order, "payment_transaction_id", None) else "")
    _send_whatsapp(phone,
        f"✅ *Order Confirmed — {order.order_number}*\n\n"
        f"Hi {first}, your order has been placed successfully!\n\n"
        f"📦 *Items Ordered:*\n{rows}\n\n"
        f"💰 *Total: ₹{order.total:,.0f}*\n"
        f"🚚 Shipping: {'FREE' if order.shipping_fee == 0 else f'₹{order.shipping_fee:,.0f}'}\n"
        f"💳 Payment: {order.payment_method.upper()}{txn_line}\n\n"
        f"📍 *Delivering to:*\n"
        f"  {addr.get('full_name','')}\n"
        f"  {addr.get('address_line1','')}, {addr.get('city','')}\n"
        f"  {addr.get('state','')} — {addr.get('pincode','')}\n\n"
        f"📲 Track your order: {STORE_URL}/orders\n"
        f"Expected delivery: 3–7 business days"
    )


# ── 15d. Order status update ──────────────────────────────────────────────────
_WA_STATUS = {
    "processing":       "🔄 Your order is being prepared by our team.",
    "shipped":          "📦 Your order has been shipped and is on its way!",
    "out_for_delivery": "🚚 Your order is out for delivery today — stay home!",
    "delivered":        "✅ Your order has been delivered. We hope you love it!\n\n⭐ Please review your purchase at the website.",
    "cancelled":        "❌ Your order has been cancelled. Any payment will be refunded in 5–7 days.",
}

def send_order_status_whatsapp(phone: str, name: str, order, new_status: str):
    first   = name.split()[0]
    message = _WA_STATUS.get(new_status, f"📋 Your order status: *{new_status}*")
    tracking = f"\n🔍 Tracking: *{order.tracking_number}*" if getattr(order, "tracking_number", None) else ""
    _send_whatsapp(phone,
        f"📬 *Order Update — {order.order_number}*\n\n"
        f"Hi {first},\n\n"
        f"{message}{tracking}\n\n"
        f"📲 Track your order: {STORE_URL}/orders"
    )


# ── 15e. Delivery OTP ─────────────────────────────────────────────────────────
def send_delivery_otp_whatsapp(phone: str, name: str, otp: str, order_number: str,
                                agent_name: str = "", agent_phone: str = ""):
    first      = name.split()[0]
    agent_info = ""
    if agent_name or agent_phone:
        agent_info = f"\n\n👤 *Delivery Agent:* {agent_name or '—'}"
        if agent_phone:
            agent_info += f"\n📞 {agent_phone}"
    _send_whatsapp(phone,
        f"🚚 *Your Order is Out for Delivery!*\n\n"
        f"Hi {first}, order *{order_number}* is on its way.{agent_info}\n\n"
        f"🔐 *Your Delivery OTP:*\n\n"
        f"*{otp}*\n\n"
        f"📌 Share this OTP only with the delivery person at your door.\n"
        f"⚠️ Never share via call or message.\n\n"
        f"📲 Track order: {STORE_URL}/orders"
    )


# ── 15f. Cart — add ───────────────────────────────────────────────────────────
def send_cart_add_sms(phone: str, product_name: str, quantity: int, cart_items: list):
    total = sum(i.get("price", 0) * i.get("quantity", 1) for i in cart_items)
    count = len(cart_items)
    _bg_sms(phone,
        f"🛒 {STORE_NAME}: Added '{product_name}' ×{quantity} to cart. "
        f"{count} item{'s' if count!=1 else ''} | ₹{total:,.0f}. "
        f"Order: {STORE_URL}/cart"
    )
    summary = _cart_text(cart_items)
    _send_whatsapp(phone,
        f"🛒 *Added to Cart!*\n\n"
        f"*{product_name}* ×{quantity} added.\n\n"
        f"🧺 *Your Cart:*\n{summary}\n\n"
        f"⚡ Stock is limited — place your order now!\n"
        f"👉 {STORE_URL}/cart"
    )


# ── 15g. Cart — remove ────────────────────────────────────────────────────────
def send_cart_remove_sms(phone: str, product_name: str, cart_items: list):
    total = sum(i.get("price", 0) * i.get("quantity", 1) for i in cart_items)
    count = len(cart_items)
    _bg_sms(phone,
        f"🗑️ {STORE_NAME}: Removed '{product_name}' from cart. "
        f"{'Cart empty.' if count == 0 else f'{count} item(s) | ₹{total:,.0f}.'} "
        f"{STORE_URL}"
    )
    summary = _cart_text(cart_items)
    _send_whatsapp(phone,
        f"🗑️ *Item Removed from Cart*\n\n"
        f"*{product_name}* has been removed.\n\n"
        + (f"🧺 *Remaining Cart:*\n{summary}\n\n👉 {STORE_URL}/cart"
           if cart_items else
           f"Your cart is now empty.\n\n🛍️ Continue shopping: {STORE_URL}/products")
    )


# ── 15h. Support rating ───────────────────────────────────────────────────────
def send_support_rating_whatsapp(phone: str, name: str, rating: int):
    first = name.split()[0]
    stars = "⭐" * rating + "☆" * (5 - rating)
    _send_whatsapp(phone,
        f"🙏 *Thank you for your feedback, {first}!*\n\n"
        f"You rated our support: {stars} ({rating}/5)\n\n"
        f"Your feedback helps us serve you better.\n"
        f"Visit us again: {STORE_URL}"
    )


# ── 15i. Review request ───────────────────────────────────────────────────────
def send_review_request_whatsapp(phone: str, name: str, order_number: str):
    first = name.split()[0]
    _send_whatsapp(phone,
        f"⭐ *How was your order, {first}?*\n\n"
        f"Your order *{order_number}* has been delivered!\n\n"
        f"We'd love to hear your thoughts. Your review helps other shoppers "
        f"and takes less than 2 minutes.\n\n"
        f"✍️ Write a review: {STORE_URL}/orders"
    )


# ── 15j. Order cancelled by user ─────────────────────────────────────────────
def send_order_cancelled_email(email: str, name: str, order):
    first  = name.split()[0]
    reason = getattr(order, "cancel_reason", "") or "Cancelled by customer"
    items_html = "".join(
        f"<tr><td style='padding:8px 0;border-bottom:1px solid #fde8d8'>{i.get('name','')}</td>"
        f"<td style='padding:8px 0;border-bottom:1px solid #fde8d8;text-align:center'>×{i.get('quantity',1)}</td>"
        f"<td style='padding:8px 0;border-bottom:1px solid #fde8d8;text-align:right'>₹{i.get('subtotal',0):,.0f}</td></tr>"
        for i in (order.items_snapshot or [])
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      {_HEADER_HTML}
      <!-- Order Cancellation sub-banner -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#b91c1c;">
        <tr><td align="center" style="padding:10px 24px 14px;">
          <p style="margin:0;color:#fca5a5;font-size:13px;font-family:Arial,sans-serif;
                    letter-spacing:1px;">ORDER CANCELLATION CONFIRMED</p>
        </td></tr>
      </table>
      <div style="padding:32px">
        <h2 style="color:#111;margin-top:0">Order Cancelled ❌</h2>
        <p style="color:#555">Hi {first}, your order has been successfully cancelled.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#991b1b"><b>Order:</b> {order.order_number}</p>
          <p style="margin:6px 0 0;color:#991b1b"><b>Reason:</b> {reason}</p>
          <p style="margin:6px 0 0;color:#991b1b"><b>Total:</b> ₹{order.total:,.0f}</p>
        </div>
        <table width="100%" style="border-collapse:collapse;margin:16px 0">
          <thead><tr style="background:#fef2f2">
            <th style="padding:8px;text-align:left;font-size:13px">Item</th>
            <th style="padding:8px;text-align:center;font-size:13px">Qty</th>
            <th style="padding:8px;text-align:right;font-size:13px">Amount</th>
          </tr></thead>
          <tbody>{items_html}</tbody>
        </table>
        {"<div style='background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:16px 0'><p style='margin:0;color:#92400e;font-size:14px'>💰 <b>Refund:</b> If you paid online, your refund will be processed within 5–7 business days to your original payment method.</p></div>" if order.payment_method != 'cod' else ""}
        <p style="color:#555;font-size:14px">Changed your mind? You can always <a href="{STORE_URL}/products" style="color:#e11d48">shop again</a>.</p>
        <p style="color:#888;font-size:13px">Questions? Email us at <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a></p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#f8f4f0;border-top:1px solid #ede8e3;">
        <tr><td align="center" style="padding:16px 24px;">
          <p style="margin:0 0 5px;color:#888;font-size:12px;font-family:Arial,sans-serif;">{STORE_ADDR}</p>
          <p style="margin:0 0 5px;font-size:12px;font-family:Arial,sans-serif;">
            <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;text-decoration:none;">Contact Support</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}" style="color:#e11d48;text-decoration:none;">Visit Store</a>
          </p>
          <p style="margin:0;color:#bbb;font-size:11px;font-family:Arial,sans-serif;">
            &copy; {YEAR} {STORE_NAME}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </div>"""
    _send_email(email, f"Order Cancelled — {order.order_number}", html)


def send_order_cancelled_whatsapp(phone: str, name: str, order):
    first  = name.split()[0]
    reason = getattr(order, "cancel_reason", "") or "Cancelled by customer"
    items_text = "\n".join(
        f"  • {i.get('name','')} ×{i.get('quantity',1)} — ₹{i.get('subtotal',0):,.0f}"
        for i in (order.items_snapshot or [])
    )
    refund_note = (
        "\n💰 *Refund:* Will be credited within 5–7 business days."
        if getattr(order, "payment_method", "cod") != "cod" else ""
    )
    _send_whatsapp(phone,
        f"❌ *Order Cancelled*\n\n"
        f"Hi {first}, your order has been cancelled.\n\n"
        f"📦 *Order:* {order.order_number}\n"
        f"📝 *Reason:* {reason}\n"
        f"💸 *Total:* ₹{order.total:,.0f}\n\n"
        f"*Items:*\n{items_text}"
        f"{refund_note}\n\n"
        f"🛍️ Shop again: {STORE_URL}/products"
    )


# ── Refund notifications ───────────────────────────────────────────────────────

def send_refund_initiated_email(email: str, name: str, order, refund_id: str = ""):
    first = name.split()[0]
    pm    = (getattr(order, "payment_method", "") or "").lower()
    txn   = getattr(order, "payment_transaction_id", "") or ""
    html  = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      {_HEADER_HTML}
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#e11d48;">
        <tr><td align="center" style="padding:8px 24px 12px;">
          <p style="margin:0;color:#fca5a5;font-size:12px;font-family:Arial,sans-serif;
                    letter-spacing:2px;text-transform:uppercase;">REFUND INITIATED</p>
        </td></tr>
      </table>
      <div style="padding:32px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px">💰</div>
        </div>
        <h2 style="color:#111;margin-top:0;text-align:center">Refund Initiated!</h2>
        <p style="color:#555;text-align:center">Hi {first}, your refund has been successfully initiated.</p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:20px 0">
          <table width="100%" style="border-collapse:collapse;font-size:14px">
            <tr><td style="color:#555;padding:5px 0">Order Number</td><td style="text-align:right;font-weight:bold;color:#111">{order.order_number}</td></tr>
            <tr><td style="color:#555;padding:5px 0">Refund Amount</td><td style="text-align:right;font-weight:bold;color:#16a34a;font-size:18px">₹{order.total:,.0f}</td></tr>
            <tr><td style="color:#555;padding:5px 0">Payment Method</td><td style="text-align:right;font-weight:bold;color:#111">{'Razorpay (Online)' if pm == 'razorpay' else pm.upper()}</td></tr>
            {f"<tr><td style='color:#555;padding:5px 0'>Transaction ID</td><td style='text-align:right;font-family:monospace;color:#666;font-size:12px'>{txn}</td></tr>" if txn else ""}
            {f"<tr><td style='color:#555;padding:5px 0'>Refund ID</td><td style='text-align:right;font-family:monospace;color:#666;font-size:12px'>{refund_id}</td></tr>" if refund_id else ""}
          </table>
        </div>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#92400e;font-size:14px">⏱️ <b>Timeline:</b> The refund will be credited to your original payment method within <b>5–7 business days</b>.</p>
        </div>

        <div style="text-align:center;margin:24px 0">
          <a href="{STORE_URL}/orders" style="background:#e11d48;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">View My Orders</a>
        </div>

        <p style="color:#888;font-size:13px;text-align:center">Questions? <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48">{SUPPORT_EMAIL}</a></p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#f8f4f0;border-top:1px solid #ede8e3;">
        <tr><td align="center" style="padding:16px 24px;">
          <p style="margin:0 0 5px;color:#888;font-size:12px;font-family:Arial,sans-serif;">{STORE_ADDR}</p>
          <p style="margin:0 0 5px;font-size:12px;font-family:Arial,sans-serif;">
            <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;text-decoration:none;">Contact Support</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}" style="color:#e11d48;text-decoration:none;">Visit Store</a>
          </p>
          <p style="margin:0;color:#bbb;font-size:11px;font-family:Arial,sans-serif;">
            &copy; {YEAR} {STORE_NAME}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </div>"""
    _send_email(email, f"💰 Refund Initiated — ₹{order.total:,.0f} · {order.order_number}", html)


def send_refund_initiated_sms(phone: str, order_number: str, total: float):
    _bg_sms(phone,
        f"💰 {STORE_NAME}: Refund of ₹{total:,.0f} initiated for order {order_number}. "
        f"Will be credited in 5-7 business days. Track: {STORE_URL}/orders"
    )


def send_refund_initiated_whatsapp(phone: str, name: str, order, refund_id: str = ""):
    first = name.split()[0]
    pm    = (getattr(order, "payment_method", "") or "").lower()
    txn   = getattr(order, "payment_transaction_id", "") or ""
    txn_line   = f"\n🔖 *Txn ID:* `{txn}`"   if txn       else ""
    refund_line = f"\n📋 *Refund ID:* `{refund_id}`" if refund_id else ""
    _send_whatsapp(phone,
        f"💰 *Refund Initiated — {order.order_number}*\n\n"
        f"Hi {first}! Your refund has been successfully initiated.\n\n"
        f"💸 *Amount:* ₹{order.total:,.0f}\n"
        f"💳 *Mode:* {'Razorpay (Online)' if pm == 'razorpay' else pm.upper()}"
        f"{txn_line}{refund_line}\n\n"
        f"⏱️ Will be credited within *5–7 business days* to your original payment method.\n\n"
        f"📦 Track orders: {STORE_URL}/orders"
    )


def send_refund_credited_email(email: str, name: str, order, refund_id: str = ""):
    """Sent when Razorpay webhook confirms refund.processed — money is credited to customer's bank."""
    first = name.split()[0]
    pm    = (getattr(order, "payment_method", "") or "").lower()
    txn   = getattr(order, "payment_transaction_id", "") or ""
    html  = _wrap(f"""
      <!-- Green sub-banner -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#16a34a;">
        <tr><td align="center" style="padding:8px 24px 12px;">
          <p style="margin:0;color:#bbf7d0;font-size:12px;font-family:Arial,sans-serif;
                    letter-spacing:2px;text-transform:uppercase;">✅ Refund Processed by Razorpay</p>
        </td></tr>
      </table>

      <div style="text-align:center;margin:28px 0 16px;">
        <div style="width:72px;height:72px;background:#dcfce7;border-radius:50%;
                    display:inline-block;line-height:72px;font-size:34px;">✅</div>
        <h2 style="color:#111;margin:16px 0 6px;font-size:22px;">
          Your Refund of ₹{order.total:,.0f} Has Been Processed!
        </h2>
        <p style="color:#555;font-size:15px;margin:0;">
          Hi {first}, Razorpay has successfully processed your refund. The amount will be credited to your bank account or card within <strong>3–5 business days</strong>. Please check your bank account or card statement.
        </p>
      </div>

      <!-- Refund details box -->
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;
                  padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:#14532d;
                  text-transform:uppercase;letter-spacing:1px;">Refund Details</p>
        <table width="100%" style="border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="color:#555;padding:6px 0;border-bottom:1px solid #d1fae5;">Order Number</td>
            <td style="text-align:right;font-weight:bold;color:#111;
                       border-bottom:1px solid #d1fae5;">{order.order_number}</td>
          </tr>
          <tr>
            <td style="color:#555;padding:6px 0;border-bottom:1px solid #d1fae5;">Refund Amount</td>
            <td style="text-align:right;font-weight:bold;color:#16a34a;font-size:20px;
                       border-bottom:1px solid #d1fae5;">₹{order.total:,.0f}</td>
          </tr>
          <tr>
            <td style="color:#555;padding:6px 0;border-bottom:1px solid #d1fae5;">Payment Method</td>
            <td style="text-align:right;font-weight:bold;color:#111;
                       border-bottom:1px solid #d1fae5;">
              {'Razorpay (Online)' if pm == 'razorpay' else pm.upper()}
            </td>
          </tr>
          {f"<tr><td style='color:#555;padding:6px 0;border-bottom:1px solid #d1fae5;'>Transaction ID</td><td style='text-align:right;font-family:monospace;color:#666;font-size:12px;border-bottom:1px solid #d1fae5;'>{txn}</td></tr>" if txn else ""}
          {f"<tr><td style='color:#555;padding:6px 0;'>Refund ID</td><td style='text-align:right;font-family:monospace;color:#666;font-size:12px;'>{refund_id}</td></tr>" if refund_id and refund_id != 'manual' else ""}
        </table>
      </div>

      {_btn("View My Orders →", f"{STORE_URL}/orders", bg="#16a34a")}

      <!-- Support section -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;
                  padding:18px 24px;margin:24px 0 8px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#1e293b;
                  text-transform:uppercase;letter-spacing:1px;">Need Help?</p>
        <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;">
          If the refund amount does not appear in your bank account or card statement within
          the expected timeframe, you can reach out to:
        </p>
        <table width="100%" style="border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;width:40%;">
              <strong style="color:#1e293b;">💳 Razorpay Support</strong><br>
              <span style="color:#64748b;font-size:12px;">For payment / refund queries</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:top;">
              <a href="https://razorpay.com/support/" style="color:#1a56db;text-decoration:none;font-weight:bold;">
                razorpay.com/support
              </a><br>
              <span style="color:#64748b;font-size:12px;">Raise a support ticket online</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;">
              <strong style="color:#1e293b;">🏪 Vijey Textile Support</strong><br>
              <span style="color:#64748b;font-size:12px;">For order / product queries</span>
            </td>
            <td style="padding:8px 0;text-align:right;vertical-align:top;">
              <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;text-decoration:none;font-weight:bold;">
                {SUPPORT_EMAIL}
              </a>
            </td>
          </tr>
        </table>
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin-top:12px;font-style:italic;">
        Your satisfaction is our top priority. We're always here to help. 💛
      </p>
    """)
    _send_email(email, f"✅ Refund of ₹{order.total:,.0f} Processed — {order.order_number}", html)


def send_refund_credited_whatsapp(phone: str, name: str, order, refund_id: str = ""):
    """Sent when Razorpay webhook confirms refund.processed — money is credited to customer's bank."""
    first = name.split()[0]
    pm    = (getattr(order, "payment_method", "") or "").lower()
    txn   = getattr(order, "payment_transaction_id", "") or ""
    txn_line    = f"\n🔖 *Transaction ID:* `{txn}`"   if txn                              else ""
    refund_line = f"\n📋 *Refund ID:* `{refund_id}`"  if refund_id and refund_id != "manual" else ""
    _send_whatsapp(phone,
        f"✅ *Refund of ₹{order.total:,.0f} Processed!*\n\n"
        f"Hi {first}! Razorpay has successfully processed your refund. 🎉\n\n"
        f"📦 *Order:* {order.order_number}\n"
        f"💸 *Refund Amount:* ₹{order.total:,.0f}\n"
        f"💳 *Payment Method:* {'Razorpay (Online)' if pm == 'razorpay' else pm.upper()}"
        f"{txn_line}{refund_line}\n\n"
        f"👉 *Please check your bank account or card statement.*\n"
        f"   The amount will be credited within *3–5 business days* (maximum).\n\n"
        f"─────────────────\n"
        f"🆘 *Need Help?*\n\n"
        f"💳 *Razorpay Support* (for payment/refund queries):\n"
        f"   🌐 https://razorpay.com/support/\n"
        f"   (Raise a ticket — they respond quickly)\n\n"
        f"🏪 *Vijey Textile Support* (for order queries):\n"
        f"   📧 {SUPPORT_EMAIL}\n\n"
        f"Your satisfaction is our top priority. We're always here for you! 💛\n\n"
        f"📦 View your orders: {STORE_URL}/orders"
    )


# ── Invoice email ──────────────────────────────────────────────────────────────

# ── Return / Exchange / Replace notifications ─────────────────────────────────

_RETURN_TYPE_LABEL = {
    "return":   "Return & Refund",
    "exchange": "Exchange",
    "replace":  "Replacement",
}

_RETURN_STATUS_INFO = {
    "pending":              ("Pending Review",              "#f59e0b", "We've received your request and will review it within 24 hours."),
    "under_review":         ("Under Review",               "#3b82f6", "Our team is reviewing your request and photos."),
    "approved":             ("Request Approved",            "#16a34a", "Your return/exchange request has been approved. We'll schedule a pickup soon."),
    "rejected":             ("Request Rejected",            "#dc2626", "Unfortunately your request could not be approved. See reason below."),
    "pickup_scheduled":     ("Pickup Scheduled",            "#e11d48", "Our courier will pick up the item from your address."),
    "picked_up":            ("Item Picked Up",              "#0891b2", "We've received your returned item and are inspecting it."),
    "processing":           ("Processing",                  "#6366f1", "Your item is being inspected by our quality team."),
    "refund_initiated":     ("Refund Initiated",            "#16a34a", "Your refund has been processed and will reach you in 5-7 business days."),
    "replacement_shipped":  ("Replacement Shipped",         "#e11d48", "Your replacement item is on its way!"),
    "completed":            ("Request Completed",           "#16a34a", "Your return/exchange process is complete. Thank you for shopping with us!"),
}

def send_return_request_email(email: str, name: str, order, rr):
    first = name.split()[0]
    type_label = _RETURN_TYPE_LABEL.get(rr.request_type, rr.request_type.title())
    html = _wrap(f"""
      <h2 style="color:#e11d48;margin-top:0;font-size:22px;">{type_label} Request Received</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, we've received your <strong>{type_label}</strong> request for order <strong>{order.order_number}</strong>.
        Our team will review it within <strong>24 hours</strong>.
      </p>
      <div style="background:#f8f4f0;border-left:4px solid #e11d48;border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Request Details</p>
        <p style="margin:4px 0;font-size:14px;color:#444;"><strong>Type:</strong> {type_label}</p>
        <p style="margin:4px 0;font-size:14px;color:#444;"><strong>Reason:</strong> {rr.reason}</p>
        {f'<p style="margin:4px 0;font-size:14px;color:#444;"><strong>Details:</strong> {rr.description}</p>' if rr.description else ''}
        <p style="margin:4px 0;font-size:14px;color:#444;"><strong>Status:</strong> <span style="color:#f59e0b;font-weight:bold;">Pending Review</span></p>
      </div>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;">
          If you uploaded photos, our team will review them during the inspection.
          Please ensure the item is unused (for size issues) and securely packed for pickup.
        </p>
      </div>
      {_btn("View Request Status", f"{STORE_URL}/orders/{order.id}")}
    """)
    _bg(email, f"{type_label} Request — {order.order_number} | {STORE_NAME}", html)

def send_return_request_whatsapp(phone: str, name: str, order, rr):
    first = name.split()[0]
    type_label = _RETURN_TYPE_LABEL.get(rr.request_type, rr.request_type.title())
    _send_whatsapp(phone,
        f"*{type_label} Request Received — {order.order_number}*\n\n"
        f"Hi {first},\n\n"
        f"We've received your {type_label} request.\n\n"
        f"*Reason:* {rr.reason}\n"
        f"*Status:* Pending Review\n\n"
        f"Our team will review within 24 hours and contact you.\n\n"
        f"Track status: {STORE_URL}/orders/{order.id}"
    )

def send_return_status_email(email: str, name: str, order, rr):
    first = name.split()[0]
    type_label = _RETURN_TYPE_LABEL.get(rr.request_type, rr.request_type.title())
    title, color, msg = _RETURN_STATUS_INFO.get(rr.status, (f"Update: {rr.status}", "#e11d48", ""))
    admin_note = (f'<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px;margin:16px 0;">'
                  f'<p style="margin:0;font-size:13px;color:#92400e;"><strong>Note from our team:</strong> {rr.admin_notes}</p></div>'
                  if rr.admin_notes else "")
    html = _wrap(f"""
      <h2 style="color:{color};margin-top:0;font-size:22px;">{title}</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        Hi {first}, here's an update on your <strong>{type_label}</strong> request for order <strong>{order.order_number}</strong>.
      </p>
      <div style="background:#f8f4f0;border-left:4px solid {color};border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:{color};font-weight:bold;font-size:14px;">{msg}</p>
      </div>
      {admin_note}
      {_btn("View Full Status", f"{STORE_URL}/orders/{order.id}")}
    """)
    _bg(email, f"{title} — {order.order_number} | {STORE_NAME}", html)

def send_return_status_whatsapp(phone: str, name: str, order, rr):
    first = name.split()[0]
    type_label = _RETURN_TYPE_LABEL.get(rr.request_type, rr.request_type.title())
    title, color, msg = _RETURN_STATUS_INFO.get(rr.status, (f"Update: {rr.status}", "#e11d48", ""))
    note = f"\n\n*Note:* {rr.admin_notes}" if rr.admin_notes else ""
    _send_whatsapp(phone,
        f"*{type_label} Update — {order.order_number}*\n\n"
        f"Hi {first},\n\n"
        f"*{title}*\n\n"
        f"{msg}{note}\n\n"
        f"View details: {STORE_URL}/orders/{order.id}"
    )


def send_invoice_email(email: str, name: str, order, user_email: str = ""):
    first = name.split()[0]
    addr  = order.shipping_address or {}
    pm    = (getattr(order, "payment_method", "") or "cod").lower()
    txn   = getattr(order, "payment_transaction_id", "") or ""
    date  = getattr(order, "created_at", None)
    date_str = date.strftime("%d %B %Y") if date else ""

    pay_label = {
        "razorpay": "Online Payment (Razorpay)",
        "upi":      "UPI Payment",
        "cod":      "Cash on Delivery",
    }.get(pm, pm.upper())

    items_rows = "".join(
        f"""<tr>
          <td style='padding:10px 8px;border-bottom:1px solid #fde8d8;font-size:13px'>
            <b>{i.get('name','')}</b>
            <br><span style='color:#888;font-size:11px'>Product ID: #{i.get('product_id','—')}
            {('· ' + i.get('size','')) if i.get('size') else ''}
            {('· ' + i.get('color','')) if i.get('color') else ''}</span>
          </td>
          <td style='padding:10px 8px;border-bottom:1px solid #fde8d8;text-align:center;font-size:13px'>{i.get('quantity',1)}</td>
          <td style='padding:10px 8px;border-bottom:1px solid #fde8d8;text-align:right;font-size:13px'>₹{i.get('price',0):,.0f}</td>
          <td style='padding:10px 8px;border-bottom:1px solid #fde8d8;text-align:right;font-size:13px;font-weight:bold'>₹{i.get('subtotal',0):,.0f}</td>
        </tr>"""
        for i in (order.items_snapshot or [])
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">

      <!-- Header — exact navbar style -->
      {_HEADER_HTML}
      <!-- TAX INVOICE badge -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#e11d48;">
        <tr>
          <td align="center" style="padding:8px 32px 14px;">
            <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="background:rgba(255,255,255,0.15);border-radius:8px;padding:7px 24px;">
                  <p style="margin:0;color:#fff;font-size:13px;font-weight:bold;
                             font-family:Arial,sans-serif;letter-spacing:1px;">TAX INVOICE</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <div style="padding:28px 32px">

        <!-- Invoice meta -->
        <table width="100%" style="border-collapse:collapse;margin-bottom:24px">
          <tr>
            <td style="font-size:13px;color:#555">
              <p style="margin:0 0 4px"><b>Invoice For:</b></p>
              <p style="margin:0;font-size:15px;font-weight:bold;color:#111">{name}</p>
              <p style="margin:2px 0;color:#666;font-size:12px">{user_email or email}</p>
              <p style="margin:2px 0;color:#666;font-size:12px">📞 {addr.get('phone','')}</p>
            </td>
            <td style="text-align:right;font-size:13px;color:#555">
              <p style="margin:0 0 4px"><b>Order Number:</b> <span style="color:#e11d48;font-weight:bold">{order.order_number}</span></p>
              <p style="margin:4px 0"><b>Date:</b> {date_str}</p>
              <p style="margin:4px 0"><b>Status:</b> <span style="text-transform:capitalize">{order.status}</span></p>
            </td>
          </tr>
        </table>

        <!-- Delivery address -->
        <div style="background:#fdf2f4;border-radius:8px;padding:14px 16px;margin-bottom:20px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:bold;color:#e11d48;text-transform:uppercase;letter-spacing:1px">Shipping Address</p>
          <p style="margin:0;font-size:13px;color:#333">
            {addr.get('full_name','')}, {addr.get('address_line1','')}{(', ' + addr.get('address_line2','')) if addr.get('address_line2') else ''}<br>
            {addr.get('city','')}, {addr.get('state','')} — {addr.get('pincode','')}<br>
            📞 {addr.get('phone','')}
          </p>
        </div>

        <!-- Items table -->
        <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="background:#e11d48;color:#fff">
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600">Item</th>
              <th style="padding:10px 8px;text-align:center;font-size:12px;font-weight:600">Qty</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600">Price</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600">Total</th>
            </tr>
          </thead>
          <tbody>{items_rows}</tbody>
        </table>

        <!-- Totals -->
        <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:5px 8px;font-size:13px;color:#666">Subtotal</td><td style="text-align:right;font-size:13px;color:#333;padding:5px 8px">₹{order.subtotal:,.0f}</td></tr>
          <tr><td style="padding:5px 8px;font-size:13px;color:#666">Shipping</td><td style="text-align:right;font-size:13px;color:{'#16a34a' if order.shipping_fee == 0 else '#333'};padding:5px 8px">{'FREE' if order.shipping_fee == 0 else f'₹{order.shipping_fee:,.0f}'}</td></tr>
          {f"<tr><td style='padding:5px 8px;font-size:13px;color:#16a34a'>Discount</td><td style='text-align:right;font-size:13px;color:#16a34a;padding:5px 8px'>-₹{order.discount:,.0f}</td></tr>" if order.discount > 0 else ""}
          <tr style="background:#fdf2f4">
            <td style="padding:12px 8px;font-size:16px;font-weight:bold;color:#e11d48">Grand Total</td>
            <td style="text-align:right;font-size:16px;font-weight:bold;color:#e11d48;padding:12px 8px">₹{order.total:,.0f}</td>
          </tr>
        </table>

        <!-- Payment info -->
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 16px;margin-bottom:20px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:bold;color:#0369a1;text-transform:uppercase;letter-spacing:1px">Payment Details</p>
          <table width="100%" style="border-collapse:collapse;font-size:13px">
            <tr><td style="color:#555;padding:3px 0">Mode</td><td style="text-align:right;font-weight:bold;color:#111">{pay_label}</td></tr>
            <tr><td style="color:#555;padding:3px 0">Status</td><td style="text-align:right;font-weight:bold;color:{'#16a34a' if order.payment_status == 'paid' else '#d97706' if order.payment_status == 'pending' else '#e11d48'}">{order.payment_status.upper()}</td></tr>
            {f"<tr><td style='color:#555;padding:3px 0'>Transaction ID</td><td style='text-align:right;font-family:monospace;color:#666;font-size:12px'>{txn}</td></tr>" if txn and txn.startswith('pay_') else ""}
          </table>
        </div>

        <!-- Download button -->
        <div style="text-align:center;margin:24px 0">
          <a href="{STORE_URL}/orders/{order.id}/invoice" style="background:#e11d48;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">📄 View & Download Invoice</a>
        </div>

      </div>

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#f8f4f0;border-top:1px solid #ede8e3;">
        <tr><td align="center" style="padding:16px 24px;">
          <p style="margin:0 0 5px;color:#888;font-size:12px;font-family:Arial,sans-serif;">{STORE_ADDR}</p>
          <p style="margin:0 0 5px;font-size:12px;font-family:Arial,sans-serif;">
            <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;text-decoration:none;">Contact Support</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}" style="color:#e11d48;text-decoration:none;">Visit Store</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}/orders" style="color:#e11d48;text-decoration:none;">My Orders</a>
          </p>
          <p style="margin:0;color:#bbb;font-size:11px;font-family:Arial,sans-serif;">
            &copy; {YEAR} {STORE_NAME}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </div>"""
    _send_email(email, f"📄 Invoice — {order.order_number} · {STORE_NAME}", html)


# ── Support Interaction Rating Request ────────────────────────────────────────

def send_support_rating_request_email(email: str, customer_name: str, cs_name: str, token: str, issue: str = ""):
    first = customer_name.split()[0]
    rating_url = f"{STORE_URL}/support/rate/{token}"
    issue_row = f"<tr><td style='color:#555;padding:5px 0'>Topic</td><td style='text-align:right;color:#111'>{issue}</td></tr>" if issue else ""
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      {_HEADER_HTML}
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#e11d48;">
        <tr><td align="center" style="padding:8px 24px 12px;">
          <p style="margin:0;color:#fca5a5;font-size:12px;font-family:Arial,sans-serif;
                    letter-spacing:2px;text-transform:uppercase;">SUPPORT EXPERIENCE</p>
        </td></tr>
      </table>
      <div style="padding:32px">
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:64px;height:64px;background:#fff7ed;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:32px">⭐</div>
        </div>
        <h2 style="color:#111;margin-top:0;text-align:center">How was your support experience?</h2>
        <p style="color:#555;text-align:center">Hi {first}, <b>{cs_name}</b> from our support team helped you recently. We'd love to know how we did!</p>
        <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;margin:20px 0">
          <table width="100%" style="border-collapse:collapse;font-size:14px">
            <tr><td style="color:#555;padding:5px 0">Support Agent</td><td style="text-align:right;font-weight:bold;color:#e11d48">{cs_name}</td></tr>
            {issue_row}
          </table>
        </div>
        <p style="color:#555;text-align:center;font-size:14px">Click below to rate your experience — it only takes 2 seconds:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="{rating_url}" style="background:#e11d48;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">⭐ Rate My Experience</a>
        </div>
        <p style="color:#aaa;font-size:12px;text-align:center">This link is unique to you and can only be used once.</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;background:#f8f4f0;border-top:1px solid #ede8e3;">
        <tr><td align="center" style="padding:16px 24px;">
          <p style="margin:0 0 5px;color:#888;font-size:12px;font-family:Arial,sans-serif;">{STORE_ADDR}</p>
          <p style="margin:0 0 5px;font-size:12px;font-family:Arial,sans-serif;">
            <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;text-decoration:none;">Contact Support</a>
            &nbsp;&middot;&nbsp;
            <a href="{STORE_URL}" style="color:#e11d48;text-decoration:none;">Visit Store</a>
          </p>
          <p style="margin:0;color:#bbb;font-size:11px;font-family:Arial,sans-serif;">
            &copy; {YEAR} {STORE_NAME}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </div>"""
    _send_email(email, f"⭐ How was your support experience? | {STORE_NAME}", html)


def send_support_rating_request_whatsapp(phone: str, customer_name: str, cs_name: str, token: str):
    first = customer_name.split()[0]
    rating_url = f"{STORE_URL}/support/rate/{token}"
    _send_whatsapp(phone,
        f"⭐ *Rate Your Support Experience*\n\n"
        f"Hi {first}! *{cs_name}* from {STORE_NAME} support helped you recently.\n\n"
        f"We'd love your feedback — tap the link to rate in 2 seconds:\n"
        f"👉 {rating_url}\n\n"
        f"_(This link is unique to you and works only once)_"
    )


# ── Admin Access Granted ───────────────────────────────────────────────────────

def send_admin_access_email(email: str, name: str):
    first = name.split()[0]
    admin_url = f"{STORE_URL}/admin"
    html = _wrap(f"""
      <!-- Alert badge -->
      <div style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 20px;margin-bottom:20px;">
        <span style="color:#15803d;font-weight:bold;font-size:14px;">✅ Admin Access Granted</span>
      </div>

      <h2 style="color:#1e293b;margin-top:0;font-size:22px;">Hi {first}, you now have Admin Access! 🎉</h2>

      <p style="color:#444;line-height:1.7;font-size:15px;">
        You have been granted <strong>Admin privileges</strong> on <strong>{STORE_NAME}</strong>.
        You can now manage the entire store from the Admin Dashboard.
      </p>

      <!-- What you can do -->
      <div style="background:#fff1f2;border-radius:12px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:#e11d48;text-transform:uppercase;letter-spacing:1px;">What you can do</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:36px;font-size:20px;">📦</td>
            <td style="padding:8px 0;">
              <span style="font-weight:bold;color:#1e293b;font-size:14px;">Manage Products</span><br>
              <span style="color:#666;font-size:13px;">Add, edit, delete products and upload images</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;font-size:20px;">🛒</td>
            <td style="padding:8px 0;">
              <span style="font-weight:bold;color:#1e293b;font-size:14px;">Manage Orders</span><br>
              <span style="color:#666;font-size:13px;">View, update order status, track shipments and initiate refunds</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;font-size:20px;">👥</td>
            <td style="padding:8px 0;">
              <span style="font-weight:bold;color:#1e293b;font-size:14px;">Manage Customers</span><br>
              <span style="color:#666;font-size:13px;">View customer accounts and grant admin access</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;font-size:20px;">💳</td>
            <td style="padding:8px 0;">
              <span style="font-weight:bold;color:#1e293b;font-size:14px;">Payments & Refunds</span><br>
              <span style="color:#666;font-size:13px;">View payment status and initiate Razorpay refunds</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;font-size:20px;">↩️</td>
            <td style="padding:8px 0;">
              <span style="font-weight:bold;color:#1e293b;font-size:14px;">Returns & Exchanges</span><br>
              <span style="color:#666;font-size:13px;">Review and process return, exchange and replacement requests</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;font-size:20px;">⭐</td>
            <td style="padding:8px 0;">
              <span style="font-weight:bold;color:#1e293b;font-size:14px;">Support & Ratings</span><br>
              <span style="color:#666;font-size:13px;">Track customer support interactions and satisfaction ratings</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- How to access -->
      <div style="background:#fdf2f4;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#e11d48;">How to access the Admin Dashboard</p>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
          Log in to <a href="{STORE_URL}" style="color:#e11d48;">{STORE_URL}</a> with your account.
          You will see an <strong>Admin Dashboard</strong> link in your profile menu at the top right.
        </p>
      </div>

      {_btn("Go to Admin Dashboard →", admin_url)}

      <hr style="border:none;border-top:1px solid #ede8e3;margin:24px 0;">
      <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
        This access was granted by the store owner. If you believe this was a mistake, please contact
        <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a>.
      </p>
    """)
    _bg(email, f"🔐 You now have Admin Access — {STORE_NAME}", html)


def send_admin_access_whatsapp(phone: str, name: str):
    first = name.split()[0]
    admin_url = f"{STORE_URL}/admin"
    _send_whatsapp(phone,
        f"🎉 *Congratulations {first}! You now have Admin Access.*\n\n"
        f"You have been granted *Admin privileges* on *{STORE_NAME}*.\n\n"
        f"*Here's what you can manage:*\n"
        f"📦 Products — Add, edit & delete products\n"
        f"🛒 Orders — View & update order status, track shipments\n"
        f"👥 Customers — View customer accounts\n"
        f"💳 Payments & Refunds — Razorpay refund management\n"
        f"↩️ Returns & Exchanges — Process return requests\n"
        f"⭐ Support Ratings — Customer satisfaction tracking\n\n"
        f"*How to access:*\n"
        f"Log in to {STORE_URL} → tap your profile → *Admin Dashboard*\n\n"
        f"👉 Go directly: {admin_url}"
    )


# ── Admin Access Revoked ────────────────────────────────────────────────────────

def send_admin_revoked_email(email: str, name: str):
    first = name.split()[0]
    html = _wrap(f"""
      <!-- Alert badge -->
      <div style="display:inline-block;background:#fff1f2;border:1px solid #fecaca;border-radius:8px;padding:10px 20px;margin-bottom:20px;">
        <span style="color:#b91c1c;font-weight:bold;font-size:14px;">🔒 Admin Access Removed</span>
      </div>

      <h2 style="color:#1e293b;margin-top:0;font-size:22px;">Hi {first}, your Admin Access has been removed.</h2>

      <p style="color:#444;line-height:1.7;font-size:15px;">
        Your <strong>Admin privileges</strong> on <strong>{STORE_NAME}</strong> have been revoked by the store owner.
        Your account remains active as a regular customer — you can still browse and shop as usual.
      </p>

      <div style="background:#fff1f2;border-radius:12px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#e11d48;text-transform:uppercase;letter-spacing:1px;">What this means</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:7px 0;vertical-align:top;width:32px;font-size:18px;">❌</td>
            <td style="padding:7px 0;font-size:14px;color:#555;">You no longer have access to the Admin Dashboard</td>
          </tr>
          <tr>
            <td style="padding:7px 0;vertical-align:top;font-size:18px;">✅</td>
            <td style="padding:7px 0;font-size:14px;color:#555;">Your customer account is still active and fully functional</td>
          </tr>
          <tr>
            <td style="padding:7px 0;vertical-align:top;font-size:18px;">🛍️</td>
            <td style="padding:7px 0;font-size:14px;color:#555;">You can continue to browse, shop, and track your orders</td>
          </tr>
        </table>
      </div>

      <div style="background:#fdf2f4;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">
          If you believe this was done in error, please contact us at
          <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;font-weight:bold;">{SUPPORT_EMAIL}</a>.
        </p>
      </div>

      {_btn("Visit Vijey Textile →", STORE_URL)}

      <hr style="border:none;border-top:1px solid #ede8e3;margin:24px 0;">
      <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
        This action was performed by the store owner. For queries, reach us at
        <a href="mailto:{SUPPORT_EMAIL}" style="color:#e11d48;">{SUPPORT_EMAIL}</a>.
      </p>
    """)
    _bg(email, f"🔒 Your Admin Access Has Been Removed — {STORE_NAME}", html)
