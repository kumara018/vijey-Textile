"""Device fingerprinting for the Linked Devices feature.

Parses a User-Agent string into a human-readable OS/browser/device summary
and best-effort geolocates an IP address — no paid API keys required.
"""
import requests


def parse_user_agent(ua: str) -> dict:
    ua = ua or ""
    ua_l = ua.lower()

    # ── OS ──────────────────────────────────────────────────────────────────
    if "iphone" in ua_l or "ipad" in ua_l:
        os_name = "iOS"
    elif "android" in ua_l:
        os_name = "Android"
    elif "mac os x" in ua_l or "macintosh" in ua_l:
        os_name = "macOS"
    elif "windows" in ua_l:
        os_name = "Windows"
    elif "linux" in ua_l:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"

    # ── Browser (order matters — Edge/Opera also contain "Chrome" in their UA) ─
    if "edg/" in ua_l or "edga/" in ua_l or "edgios/" in ua_l:
        browser = "Edge"
    elif "opr/" in ua_l or "opera" in ua_l:
        browser = "Opera"
    elif "crios" in ua_l:
        browser = "Chrome"
    elif "fxios" in ua_l or "firefox" in ua_l:
        browser = "Firefox"
    elif "chrome" in ua_l:
        browser = "Chrome"
    elif "safari" in ua_l:
        browser = "Safari"
    else:
        browser = "Unknown Browser"

    # ── Device type ─────────────────────────────────────────────────────────
    if "ipad" in ua_l or "tablet" in ua_l:
        device_type = "tablet"
    elif "iphone" in ua_l or "android" in ua_l or "mobile" in ua_l:
        device_type = "mobile"
    else:
        device_type = "desktop"

    return {
        "os_name": os_name,
        "browser_name": browser,
        "device_type": device_type,
        "device_name": f"{browser} on {os_name}",
    }


def get_client_ip(request) -> str:
    """Render/most PaaS providers sit behind a proxy — real client IP is in X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def geolocate_ip(ip: str) -> str | None:
    """Best-effort city/region/country lookup. Returns None on any failure —
    a missing location must never block login. Logged (not raised) so a
    string of "Unknown location" entries in Render logs is actually
    diagnosable instead of a silent guess — get_current_user retries this
    on a device's next active use, so a transient failure here is not
    permanent for that session."""
    if not ip or ip in ("127.0.0.1", "::1") or ip.startswith("192.168.") or ip.startswith("10."):
        return None
    try:
        resp = requests.get(f"https://ipapi.co/{ip}/json/", timeout=5)
        if resp.status_code != 200:
            print(f"[GeoIP] {ip}: HTTP {resp.status_code} from ipapi.co — {resp.text[:200]}")
            return None
        data = resp.json()
        if data.get("error"):
            print(f"[GeoIP] {ip}: ipapi.co returned error — {data.get('reason', data)}")
            return None
        parts = [p for p in (data.get("city"), data.get("region"), data.get("country_name")) if p]
        return ", ".join(parts) if parts else None
    except Exception as e:
        print(f"[GeoIP] {ip}: lookup failed — {e}")
        return None
