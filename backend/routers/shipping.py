"""
Public shipping questions — currently one: can you deliver to my pincode?

WHY THIS IS ITS OWN PUBLIC ROUTER. Serviceability already existed, in
`routers/admin.py`, gated behind `get_current_admin` and keyed to an ORDER. That
is the right shape for the shopkeeper checking a booking that already exists,
and the wrong shape for the only person who actually needs the answer first: a
customer standing on the homepage deciding whether this shop delivers to them at
all. Asking them to add to a bag, sign in, and reach checkout before the site
will say "no, not your area" is the most expensive possible moment to find out.

WHAT IT DELIBERATELY DOES NOT DO. It does not guess a city name. The obvious
move is to look the pincode up somewhere and print "Deliver to Coimbatore
641001", and Delhivery's charges endpoint does not return a place name, so that
would mean a second external service and a name this shop cannot vouch for. A
wrong city under a "Deliver to" heading is worse than no city — it reads as the
site knowing something about you, incorrectly. A signed-in customer's saved
address already carries a real city, and that is what the frontend shows when it
has one; otherwise it shows the pincode, which is exactly what the customer
typed and therefore always right.

The cache is small and in-process on purpose. Pincode serviceability changes on
the order of weeks, the shop has one origin, and the realistic worst case is a
few hundred distinct pincodes — a dict is the correct size of solution, and it
keeps a homepage widget from spending a Delhivery call per page view.
"""
from __future__ import annotations

import os
import re
import time

from fastapi import APIRouter, HTTPException

import delhivery as dl

router = APIRouter(prefix="/api/shipping", tags=["shipping"])

_PIN = re.compile(r"^[1-9][0-9]{5}$")

# pincode -> (serviceable, checked_at)
_CACHE: dict[str, tuple[bool, float]] = {}
_TTL_SECONDS = 60 * 60 * 12


@router.get("/serviceability")
def serviceability(pincode: str):
    """
    Can we deliver to this pincode?

    `serviceable` is deliberately three-valued in effect: true, false, or —
    when Delhivery is not configured or does not answer — `checked: false`,
    which the frontend must render as "we will confirm", never as a refusal.
    Telling somebody the shop cannot reach them because an API call timed out
    would lose an order the shop could have fulfilled.
    """
    pin = (pincode or "").strip()
    if not _PIN.match(pin):
        raise HTTPException(422, "Enter a six-digit Indian pincode.")

    now = time.time()
    hit = _CACHE.get(pin)
    if hit and now - hit[1] < _TTL_SECONDS:
        return {"pincode": pin, "serviceable": hit[0], "checked": True, "cached": True}

    origin = os.getenv("DELHIVERY_RETURN_PIN", "638102")
    result = dl.check_serviceability(origin, pin)

    # Not configured, or the call failed: say so rather than inventing a "no".
    if result is None:
        return {"pincode": pin, "serviceable": None, "checked": False, "cached": False}

    # `serviceable` is now stated by the courier rather than inferred from the
    # absence of an error key. The old reading — "no error field, therefore we
    # deliver" — would call every unserved pincode deliverable the moment the
    # endpoint answered cleanly, which is the failure that costs a customer a
    # parcel rather than a sale.
    ok = bool(result.get("serviceable"))
    _CACHE[pin] = (ok, now)
    out = {"pincode": pin, "serviceable": ok, "checked": True, "cached": False}
    if ok and result.get("district"):
        # The place name, which lets a customer confirm the pincode they typed
        # is the one they meant.
        #
        # `cod` AND `prepaid` ARE DELIBERATELY NOT PUBLISHED. Delhivery reports
        # them, and they are the COURIER'S capability - "we can collect cash
        # at this pincode" - not this shop's policy. Neither shop offers cash
        # on delivery: checkout takes Razorpay only. Publishing cod:true on an
        # endpoint any customer can call reads as an offer the shop does not
        # make, and the first person to wire it into the UI would be building
        # on a promise nobody made. `check_serviceability` still returns them
        # for the day COD is offered; until then they stay inside the server.
        out["district"] = result["district"]
    return out
