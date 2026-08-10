"""
Delhivery Direct API client for Vijey Textile.

Env vars required:
  DELHIVERY_API_TOKEN      — from Delhivery dashboard → Settings → API
  DELHIVERY_PICKUP_NAME    — pickup location name in Delhivery dashboard (default: Primary)
  DELHIVERY_RETURN_PIN     — your shop pincode e.g. 638001
  DELHIVERY_RETURN_CITY    — your city e.g. Gangapuram
  DELHIVERY_RETURN_STATE   — Tamil Nadu
  DELHIVERY_RETURN_PHONE   — your shop phone
  DELHIVERY_RETURN_NAME    — Vijey Textile
  DELHIVERY_RETURN_ADDRESS — Shop Ground Floor No 131, Texvalley Gangapuram
  DELHIVERY_MODE           — production (default) or test

Delhivery API docs: https://dev.delhivery.com
"""
import os, json
import urllib.request as _req
import urllib.error   as _uerr
import urllib.parse   as _parse
import requests as _requests


def _base() -> str:
    mode = os.getenv("DELHIVERY_MODE", "production").strip().lower()
    if mode == "test":
        return "https://staging-express.delhivery.com"
    return "https://track.delhivery.com"


def _token() -> str:
    return os.getenv("DELHIVERY_API_TOKEN", "").strip()


def _headers() -> dict:
    return {
        "Authorization": f"Token {_token()}",
        "Content-Type":  "application/json",
    }


def is_configured() -> bool:
    return bool(_token())


# ── Create shipment (generate waybill) ────────────────────────────────────────
def create_shipment(order, user) -> dict | None:
    """
    Creates a shipment on Delhivery and returns the response dict.
    On success, response contains 'packages' list with 'waybill' (AWB) inside.
    """
    addr = order.shipping_address or {}

    # Build items description — ASCII only (strip non-ASCII to avoid encoding issues)
    items = order.items_snapshot or []
    products_desc = ", ".join(
        f"{i.get('name', 'Product')} x{i.get('quantity', 1)}" for i in items
    ) or "Textile Products"
    products_desc = products_desc.encode("ascii", errors="ignore").decode("ascii")

    pm = (order.payment_method or "").strip().lower()
    print(f"[Delhivery] order.payment_method={order.payment_method!r}  normalised={pm!r}")

    is_cod     = (pm == "cod")
    # Delhivery CMU API valid values: "COD" or "Pre-paid"
    payment    = "COD" if is_cod else "Pre-paid"
    cod_amount = str(round(order.total, 2)) if is_cod else "0"

    def _ascii(s: str) -> str:
        """Strip non-ASCII characters so the JSON stays pure ASCII."""
        return (s or "").encode("ascii", errors="ignore").decode("ascii").strip()

    shipment = {
        "name":           _ascii(addr.get("full_name") or (user.full_name if user else "Customer")),
        "add":            _ascii(" ".join(filter(None, [
                              addr.get("address_line1", ""),
                              addr.get("address_line2", ""),
                          ]))),
        "pin":            str(addr.get("pincode", "")),
        "city":           _ascii(addr.get("city", "")),
        "state":          _ascii(addr.get("state", "Tamil Nadu")),
        "country":        "India",
        "phone":          str(addr.get("phone") or (user.phone if user else "")),
        "order":          order.order_number,
        # Send under BOTH field names — different Delhivery API versions differ
        "payment_mode":   payment,
        "payment":        payment,
        "return_pin":     os.getenv("DELHIVERY_RETURN_PIN",     "638001"),
        "return_city":    os.getenv("DELHIVERY_RETURN_CITY",    "Gangapuram"),
        "return_state":   os.getenv("DELHIVERY_RETURN_STATE",   "Tamil Nadu"),
        "return_country": "India",
        "return_phone":   os.getenv("DELHIVERY_RETURN_PHONE",   ""),
        "return_name":    os.getenv("DELHIVERY_RETURN_NAME",    "Vijey Textile"),
        "return_add":     os.getenv("DELHIVERY_RETURN_ADDRESS", "Shop Ground Floor No 131, Texvalley Gangapuram"),
        "return_time":    "72",
        "products_desc":  products_desc,
        "hsn_code":       "",
        "cod_amount":     cod_amount,
        "total_amount":   str(round(order.total, 2)),
        "shipment_width":  20,
        "shipment_height": 5,
        "shipment_length": 25,
        "weight":          0.5,
        "quantity":        len(items) or 1,
        "waybill":         "",
        "seller_tin":      "",
        "seller_gst_tin":  "",
    }

    pickup_name = os.getenv("DELHIVERY_PICKUP_NAME", "Primary")
    payload = {
        "shipments":       [shipment],
        "pickup_location": {"name": pickup_name},
    }

    try:
        # ensure_ascii=True → all chars are pure ASCII (\uXXXX for any non-ASCII)
        # This prevents UTF-8 byte sequences inside the URL-encoded body that
        # some versions of Delhivery's PHP parser cannot handle correctly.
        data_json = json.dumps(payload, ensure_ascii=True, separators=(',', ':'))

        print(f"[Delhivery] pickup_name={pickup_name!r}  payment={payment!r}")
        print(f"[Delhivery] JSON being sent: {data_json}")

        # Use the `requests` library — it handles Content-Type and encoding reliably.
        # Passes data as application/x-www-form-urlencoded form fields.
        resp = _requests.post(
            f"{_base()}/api/cmu/create.json",
            data    = {"format": "json", "data": data_json},
            headers = {"Authorization": f"Token {_token()}"},
            timeout = 20,
        )
        print(f"[Delhivery] HTTP {resp.status_code}  body={resp.text[:500]}")
        result = resp.json()
        print(f"[Delhivery] Parsed response: {result}")
        return result
    except Exception as e:
        print(f"[Delhivery] Create shipment error: {e}")
        return None


# ── Track by AWB ──────────────────────────────────────────────────────────────
def track_awb(awb: str) -> dict | None:
    """
    Returns full tracking data for a waybill.
    Key fields in response:
      ShipmentData[0].Shipment.Status.Status         → current status string
      ShipmentData[0].Shipment.Status.StatusLocation → current city/hub
      ShipmentData[0].Shipment.Scans[]               → scan events with location + time
      ShipmentData[0].Shipment.ExpectedDeliveryDate  → EDD
    """
    if not is_configured():
        return None
    try:
        url = f"{_base()}/api/v1/packages/json/?waybill={awb}&verbose=true"
        req = _req.Request(url, headers=_headers(), method="GET")
        with _req.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[Delhivery] Track error: {e}")
        return None


# ── Cancel shipment ───────────────────────────────────────────────────────────
def cancel_shipment(awb: str) -> dict | None:
    if not is_configured():
        return None
    try:
        url = f"{_base()}/api/p/edit?wbn={awb}&cancellation=true"
        req = _req.Request(url, headers=_headers(), method="POST", data=b"")
        with _req.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[Delhivery] Cancel error: {e}")
        return None


# ── Reverse pickup for a return (best effort) ─────────────────────────────────
# NOTE: Delhivery's actual reverse-pickup (RVP) contract can vary by account
# setup. This mirrors create_shipment() with pickup/destination swapped
# (collect FROM the customer, return TO the shop) using the same CMU endpoint,
# which is the common pattern — but verify against your live Delhivery
# account before relying on it. Callers must treat a None return as "schedule
# this pickup manually" rather than a hard failure, since a courier issue
# should never block a return being approved.
def create_return_pickup(order, user) -> dict | None:
    if not is_configured():
        return None
    addr = order.shipping_address or {}

    def _ascii(s: str) -> str:
        return (s or "").encode("ascii", errors="ignore").decode("ascii").strip()

    shipment = {
        # Customer becomes the pickup point for a reverse shipment
        "name":    _ascii(addr.get("full_name") or (user.full_name if user else "Customer")),
        "add":     _ascii(" ".join(filter(None, [addr.get("address_line1", ""), addr.get("address_line2", "")]))),
        "pin":     str(addr.get("pincode", "")),
        "city":    _ascii(addr.get("city", "")),
        "state":   _ascii(addr.get("state", "Tamil Nadu")),
        "country": "India",
        "phone":   str(addr.get("phone") or (user.phone if user else "")),
        "order":   f"RVP-{order.order_number}",
        "payment_mode":   "Pickup",
        "payment":        "Pickup",
        # Shop becomes the delivery destination for the returned item
        "return_pin":     os.getenv("DELHIVERY_RETURN_PIN",     "638001"),
        "return_city":    os.getenv("DELHIVERY_RETURN_CITY",    "Gangapuram"),
        "return_state":   os.getenv("DELHIVERY_RETURN_STATE",   "Tamil Nadu"),
        "return_country": "India",
        "return_phone":   os.getenv("DELHIVERY_RETURN_PHONE",   ""),
        "return_name":    os.getenv("DELHIVERY_RETURN_NAME",    "Vijey Textile"),
        "return_add":     os.getenv("DELHIVERY_RETURN_ADDRESS", "Shop Ground Floor No 131, Texvalley Gangapuram"),
        "return_time":    "72",
        "products_desc":  "Return pickup",
        "hsn_code":       "",
        "cod_amount":     "0",
        "total_amount":   str(round(order.total, 2)),
        "shipment_width":  20,
        "shipment_height": 5,
        "shipment_length": 25,
        "weight":          0.5,
        "quantity":        1,
        "waybill":         "",
        "seller_tin":      "",
        "seller_gst_tin":  "",
        "is_return":       True,
    }

    pickup_name = os.getenv("DELHIVERY_PICKUP_NAME", "Primary")
    payload = {"shipments": [shipment], "pickup_location": {"name": pickup_name}}

    try:
        data_json = json.dumps(payload, ensure_ascii=True, separators=(',', ':'))
        resp = _requests.post(
            f"{_base()}/api/cmu/create.json",
            data    = {"format": "json", "data": data_json},
            headers = {"Authorization": f"Token {_token()}"},
            timeout = 20,
        )
        print(f"[Delhivery] Return pickup HTTP {resp.status_code}  body={resp.text[:500]}")
        return resp.json()
    except Exception as e:
        print(f"[Delhivery] Return pickup error: {e}")
        return None


# ── Forward shipment for an exchange's replacement item ───────────────────────
# Not the same call as create_shipment() — there's no real Order row for the
# replacement, just a ReturnRequest pointing at a new_product. This is the
# second leg of an exchange: once the old item is picked up (see
# create_return_pickup above), the replacement goes out as its own fresh
# forward shipment to the same address — the same two-leg pattern
# Amazon/Flipkart/Myntra use for apparel exchanges rather than a same-visit
# swap, since the replacement's exact size/colour/stock needs its own
# verified shipment like any other order.
def create_replacement_shipment(rr, order, user) -> dict | None:
    if not is_configured():
        return None
    addr = order.shipping_address or {}
    new_product = rr.new_product

    def _ascii(s: str) -> str:
        return (s or "").encode("ascii", errors="ignore").decode("ascii").strip()

    desc = new_product.name if new_product else "Replacement item"
    if rr.new_size:
        desc += f" ({rr.new_size})"

    shipment = {
        "name":    _ascii(addr.get("full_name") or (user.full_name if user else "Customer")),
        "add":     _ascii(" ".join(filter(None, [addr.get("address_line1", ""), addr.get("address_line2", "")]))),
        "pin":     str(addr.get("pincode", "")),
        "city":    _ascii(addr.get("city", "")),
        "state":   _ascii(addr.get("state", "Tamil Nadu")),
        "country": "India",
        "phone":   str(addr.get("phone") or (user.phone if user else "")),
        "order":   f"EXC-{order.order_number}",
        # A replacement swap never collects COD, regardless of how the
        # original order was paid — the customer already paid (or owes
        # nothing more) for the item being exchanged.
        "payment_mode":   "Pre-paid",
        "payment":        "Pre-paid",
        "return_pin":     os.getenv("DELHIVERY_RETURN_PIN",     "638001"),
        "return_city":    os.getenv("DELHIVERY_RETURN_CITY",    "Gangapuram"),
        "return_state":   os.getenv("DELHIVERY_RETURN_STATE",   "Tamil Nadu"),
        "return_country": "India",
        "return_phone":   os.getenv("DELHIVERY_RETURN_PHONE",   ""),
        "return_name":    os.getenv("DELHIVERY_RETURN_NAME",    "Vijey Textile"),
        "return_add":     os.getenv("DELHIVERY_RETURN_ADDRESS", "Shop Ground Floor No 131, Texvalley Gangapuram"),
        "return_time":    "72",
        "products_desc":  _ascii(desc),
        "hsn_code":       "",
        "cod_amount":     "0",
        "total_amount":   str(round(new_product.price, 2)) if new_product else "0",
        "shipment_width":  20,
        "shipment_height": 5,
        "shipment_length": 25,
        "weight":          0.5,
        "quantity":        1,
        "waybill":         "",
        "seller_tin":      "",
        "seller_gst_tin":  "",
    }

    pickup_name = os.getenv("DELHIVERY_PICKUP_NAME", "Primary")
    payload = {"shipments": [shipment], "pickup_location": {"name": pickup_name}}

    try:
        data_json = json.dumps(payload, ensure_ascii=True, separators=(',', ':'))
        resp = _requests.post(
            f"{_base()}/api/cmu/create.json",
            data    = {"format": "json", "data": data_json},
            headers = {"Authorization": f"Token {_token()}"},
            timeout = 20,
        )
        print(f"[Delhivery] Replacement shipment HTTP {resp.status_code}  body={resp.text[:500]}")
        return resp.json()
    except Exception as e:
        print(f"[Delhivery] Replacement shipment error: {e}")
        return None


# ── Check serviceability (pincode reachable?) ─────────────────────────────────
def check_serviceability(origin_pin: str, dest_pin: str, weight_grams: int = 500) -> dict | None:
    if not is_configured():
        return None
    try:
        params = _parse.urlencode({
            "md":  "E",
            "cgm": weight_grams,
            "o_pin": origin_pin,
            "d_pin": dest_pin,
            "ss":  "DTO",
            "pt":  "Pre-paid",
        })
        url = f"{_base()}/api/kinko/v1/invoice/charges/?{params}"
        req = _req.Request(url, headers=_headers(), method="GET")
        with _req.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[Delhivery] Serviceability error: {e}")
        return None


# ── Parse tracking events into a clean list ───────────────────────────────────
def parse_tracking_events(raw: dict) -> list:
    """
    Convert raw Delhivery track response into a clean list of events:
    [{ "status": str, "location": str, "datetime": str }]
    """
    try:
        shipment = raw["ShipmentData"][0]["Shipment"]
        scans    = shipment.get("Scans", [])
        events   = []
        for s in scans:
            detail = s.get("ScanDetail", {})
            events.append({
                "status":   detail.get("Scan") or detail.get("Instructions", ""),
                "activity": detail.get("Instructions") or detail.get("Scan", ""),
                "location": detail.get("ScannedLocation", ""),
                "datetime": detail.get("ScanDateTime") or detail.get("StatusDateTime", ""),
            })
        return events
    except Exception:
        return []


def parse_create_response(result: dict | None) -> tuple[str, str]:
    """
    Validates a Delhivery cmu/create.json response — shared by forward
    shipment creation AND reverse/return pickup creation AND the exchange
    replacement shipment, since all three hit the same endpoint and get
    back the same response shape:
    { "packages": [{ "waybill": "...", "error"/"remarks": "..." }], "success": true/false }

    Delhivery can return HTTP 200 with a non-empty JSON body even when it
    didn't actually create anything (success=false, or success=true with a
    per-package error and no waybill) — a bare truthy check on the response
    dict is NOT enough to know a shipment/pickup genuinely exists on
    Delhivery's side. This is exactly what let a return's status become
    "Pickup Scheduled" while Delhivery's own dashboard showed nothing.

    Returns (awb, error_message) — exactly one of the two is non-empty.
    """
    if not result:
        return "", "No response from Delhivery"

    packages = result.get("packages", [])
    success  = result.get("success", False)

    if not success and not packages:
        return "", result.get("rmk") or result.get("error") or str(result)
    if not packages:
        return "", result.get("rmk") or result.get("error") or str(result)

    pkg_err = packages[0].get("error") or packages[0].get("remarks") or ""
    awb     = packages[0].get("waybill", "")
    if not awb:
        return "", pkg_err or f"Delhivery did not return an AWB. Full response: {result}"
    return awb, ""


def parse_current_status(raw: dict) -> dict:
    """
    Extract current status and EDD from a Delhivery response. Handles both
    shapes this app receives: track_awb()'s `{"ShipmentData": [{"Shipment": {...}}]}`
    and the Push API webhook's flatter `{"Shipment": {...}}` (no ShipmentData
    wrapper, no list) — same inner "Shipment" object either way.
    """
    try:
        if "ShipmentData" in raw:
            shipment = raw["ShipmentData"][0]["Shipment"]
        else:
            shipment = raw["Shipment"]
        status = shipment.get("Status", {})
        return {
            "status":           status.get("Status", ""),
            "location":         status.get("StatusLocation", ""),
            "datetime":         status.get("StatusDateTime", ""),
            "expected_delivery":shipment.get("ExpectedDeliveryDate", ""),
            "awb":              shipment.get("AWB", ""),
        }
    except Exception:
        return {}
