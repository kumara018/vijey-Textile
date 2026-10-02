"""
The sign-up page and /api/auth/register must agree on what a sign-up is.

They did not. schemas.UserRegister requires six fields; the page sent four
(no confirm_password, no agree_terms), so every sign-up on both shops was
refused with a 422 and the screen said only "We could not create that account".
No new customer could register, and nothing in the test suite noticed, because
every test that made a customer built the row directly in the database.

These tests post exactly what frontend/src/app/auth/register/page.tsx sends.
If either side changes, change both — and this file.
"""

# What register/page.tsx sends, field for field. A real-looking domain, because
# the email validator rightly refuses reserved ones such as .local; every outbound
# message is stubbed in the test app, so nothing is sent anywhere.
PAGE_PAYLOAD = {
    "full_name": "Sign Up Contract",
    "email": "signup.contract.qa@gmail.com",
    "phone": "+919876512345",
    "password": "Contract@2026",
    "confirm_password": "Contract@2026",
    "agree_terms": True,
}


def test_the_payload_the_signup_page_sends_is_accepted(client):
    r = client.post("/api/auth/register", json=PAGE_PAYLOAD)
    assert r.status_code in (200, 201), (
        f"the sign-up page's own payload was refused: {r.status_code} {r.text[:300]}"
    )


def test_the_old_four_field_payload_is_what_used_to_fail(client):
    """Kept so the reason for the two extra fields is recorded, not rediscovered."""
    old = {k: PAGE_PAYLOAD[k] for k in ("full_name", "email", "phone", "password")}
    old["email"] = "signup.old.qa@gmail.com"
    old["phone"] = "+919876512346"
    r = client.post("/api/auth/register", json=old)
    assert r.status_code == 422
    missing = {e["loc"][-1] for e in r.json()["detail"] if e["type"] == "missing"}
    assert {"confirm_password", "agree_terms"} <= missing, missing
