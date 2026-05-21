"""
Shiprocket API client for Vijey Textile.
Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in Render env vars.
"""
import os, json
import urllib.request as _req
import urllib.error as _uerr
from datetime import datetime, timedelta


class ShiprocketClient:
    BASE = "https://apiv2.shiprocket.in/v1/external"
    _token: str | None = None
    _token_expiry: datetime | None = None

    def _get_token(self) -> str | None:
        if self._token and self._token_expiry and datetime.now() < self._token_expiry:
            return self._token

        email    = os.getenv("SHIPROCKET_EMAIL", "").strip()
        password = os.getenv("SHIPROCKET_PASSWORD", "").strip()
        if not email or not password:
            return None

        try:
            payload = json.dumps({"email": email, "password": password}).encode()
            req = _req.Request(
                f"{self.BASE}/auth/login",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with _req.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                self._token        = data.get("token")
                self._token_expiry = datetime.now() + timedelta(days=9)
                print("[Shiprocket] Auth token refreshed ✓")
                return self._token
        except Exception as e:
            print(f"[Shiprocket] Auth error: {e}")
            return None

    def _headers(self) -> dict | None:
        token = self._get_token()
        if not token:
            return None
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ── Track by AWB ──────────────────────────────────────────────────────────
    def track_awb(self, awb: str) -> dict | None:
        headers = self._headers()
        if not headers:
            return None
        try:
            req = _req.Request(
                f"{self.BASE}/courier/track/awb/{awb}",
                headers=headers,
                method="GET",
            )
            with _req.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception as e:
            print(f"[Shiprocket] Track error: {e}")
            return None

    # ── Create order + shipment (forward) ────────────────────────────────────
    def create_forward_shipment(self, payload: dict) -> dict | None:
        headers = self._headers()
        if not headers:
            return None
        try:
            data = json.dumps(payload).encode()
            req = _req.Request(
                f"{self.BASE}/shipments/create/forward-shipment/",
                data=data,
                headers=headers,
                method="POST",
            )
            with _req.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except _uerr.HTTPError as e:
            body = e.read().decode(errors="ignore")
            print(f"[Shiprocket] Create shipment HTTP {e.code}: {body}")
            return None
        except Exception as e:
            print(f"[Shiprocket] Create shipment error: {e}")
            return None

    # ── Cancel order on Shiprocket ────────────────────────────────────────────
    def cancel_order(self, shiprocket_order_ids: list) -> dict | None:
        headers = self._headers()
        if not headers:
            return None
        try:
            data = json.dumps({"ids": shiprocket_order_ids}).encode()
            req = _req.Request(
                f"{self.BASE}/orders/cancel",
                data=data,
                headers=headers,
                method="POST",
            )
            with _req.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception as e:
            print(f"[Shiprocket] Cancel error: {e}")
            return None

    def is_configured(self) -> bool:
        return bool(
            os.getenv("SHIPROCKET_EMAIL", "").strip() and
            os.getenv("SHIPROCKET_PASSWORD", "").strip()
        )


# Singleton instance
shiprocket = ShiprocketClient()
