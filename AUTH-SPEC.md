# Auth & Session Spec — Vijey Textile

**Status: specification only. No backend code written.** Everything below is a
proposal for the backend owner. Read-only analysis of `backend/routers/auth.py`,
`backend/auth.py`, `backend/schemas.py`.

Two deliverables: **progressive sign-in** (Amazon-style single-field entry) and
**device/session handling** (in-flow eviction + an account surface).

---

## Part 0 — What exists today, read from the code

### 0.1 Sign-in is two-step OTP, not password-only

| Step | Endpoint | Behaviour |
|---|---|---|
| 1 | `POST /api/auth/send-login-otp` | Takes `{identifier, password}`. Verifies **both**, then emails an OTP. |
| 2 | `POST /api/auth/verify-login-otp` | Takes `{identifier, otp}`. Returns `{access_token, token_type, user}`. |

`_find_user` (`routers/auth.py:33`) resolves an identifier as email if it
contains `@`, otherwise normalises it as a phone. So one field already accepts
both — the frontend does not need a type toggle.

### 0.2 The device cap and the 409

`MAX_DEVICES = 4` (`routers/auth.py:14`). `_create_session_or_409` raises:

```jsonc
// HTTP 409
{
  "detail": {
    "code": "device_limit",
    "message": "You're signed in on 4 devices already — the maximum allowed. Sign out of one to continue.",
    "pending_token": "<JWT>",
    "sessions": [
      {
        "id": 12,
        "device_name": "iPhone",
        "os_name": "iOS 17",
        "browser_name": "Safari",
        "device_type": "mobile",
        "location": "Erode, Tamil Nadu",
        "created_at": "2026-08-01T09:12:00+00:00",
        "last_active_at": "2026-08-16T04:02:00+00:00"
      }
    ]
  }
}
```

**Answering the question directly: yes, `pending_token` completes the sign-in.**
It is a 5-minute single-purpose action token (`auth.py:117`, purpose
`device_evict`, carrying `uid`). `POST /api/auth/sessions/evict-and-login`
takes `{pending_token, session_id}`, revokes that session, creates a new one,
and returns a full `Token` — **the customer does not re-enter a password or a
second OTP.** The flow is already designed to be completed in place.

Trigger: the cap is checked *at session creation*, which happens at the end of
`verify-login-otp` — so the 409 arrives **after** the OTP has been accepted,
not before. The customer has already proved who they are when they see it.

Also worth knowing: `_create_session_or_409` de-duplicates by device
signature — signing in again from the same device/OS/browser revokes the old
row rather than adding a second one. So the cap is rarely hit by the same
person on the same phone.

### 0.3 Session endpoints that already exist

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/sessions` | All active devices for the current user. Self-heals the current session into the list if an expiry edge case dropped it. |
| `DELETE /api/auth/sessions/{id}` | Sign out one device. |
| `POST /api/auth/logout` | Sign out; accepts an explicit token so one saved account can be signed out while switching to another. |

**Missing: a "sign out everywhere" endpoint.** See §3.3.

---

## Part 1 — The enumeration problem, stated honestly

### 1.1 The exposure

Progressive sign-in needs the server to answer *"is this identifier
registered?"* before any credential is supplied. That endpoint is an
enumeration oracle: anyone can walk a list of phone numbers and learn which
belong to your customers. For a children's clothing shop that is a list of
parents, which is worse than an average leak.

### 1.2 The backend already leaks this — two ways, today

**This is not a new exposure being introduced. It exists now.**

1. **`/forgot-password` (`routers/auth.py:348`)** carries the comment
   `# Don't reveal if user exists — just return success`, and then does exactly
   the opposite. Unknown identifier returns
   `{"message": "If this account exists, an OTP has been sent."}`. Known
   identifier returns a *different* message plus an `email_hint` field. The two
   responses are trivially distinguishable. **The mitigation was intended and
   not implemented.**

2. **`/send-login-otp` leaks by timing, not by response.** The bodies are
   correctly identical — a missing user and a wrong password both return the
   same 401. But `if not user or not verify_password(...)` short-circuits, so a
   missing account skips bcrypt entirely and answers ~1000× faster. See **R3**,
   which is the actionable form of this.

   *(An earlier draft of this document claimed the two 403 branches below that
   check — deactivated, unverified — were the leak. They are not: both sit
   behind a successful password verification. That claim is withdrawn in §3.5.)*

3. **`/verify-login-otp` returns 404 "Account not found."**

### 1.3 There is no rate limiting anywhere

I searched the backend for `slowapi`, `limiter`, `RateLimit` — **nothing**. No
per-IP or per-identifier throttling on any auth endpoint. That is what turns
the leak in §1.2 from a nuisance into a practical bulk-enumeration tool: an
attacker can test identifiers as fast as the server will answer.

**This is the single highest-value backend fix on this page, and it is worth
doing whether or not progressive sign-in is ever built.**

### 1.4 What Amazon actually does

Amazon **reveals**. Enter an unregistered email on amazon.com and it moves you
to the create-account form with the address pre-filled; enter a registered one
and it asks for a password. They accept enumeration as an explicit trade for a
markedly better funnel, and they defend it with layers you currently have none
of:

- aggressive per-IP and per-identifier rate limiting
- bot/behavioural detection, escalating to CAPTCHA on suspicion
- device fingerprinting and reputation
- the observation that email addresses are weak secrets already

The part of that reasoning that **does not transfer** to this shop: your
primary identifier is a **phone number**, not an email. Indian mobile numbers
are densely packed and cheaply enumerable (a 10-digit space with known
prefixes), whereas email addresses are sparse. Confirming "this number shops at
Vijey Textile" is a meaningfully worse disclosure than confirming an email, and
it is easier to harvest at scale.

### 1.5 Recommendation

**Option B (blind branch) is my recommendation.** Both are specified so you can
choose.

---

## Part 2 — Progressive sign-in

### Option A — Reveal, then mitigate (Amazon's model)

```
POST /api/auth/identify
Body:     { "identifier": "9443947853" }
200:      { "exists": true,  "method": "password", "hint": "vij***@gmail.com" }
          { "exists": false, "method": "register" }
429:      { "detail": "Too many attempts. Try again in a minute." }
```

**Mandatory conditions — this endpoint must not ship without all four:**

1. **Rate limit**: per-IP ~5/min and ~30/hour, *and* per-identifier ~5/hour.
   Per-IP alone is defeated by a proxy pool; per-identifier alone is defeated
   by walking the number space. Both are required.
2. **Uniform timing**: the "not found" branch must take the same time as the
   "found" branch. Right now `_find_user` returns immediately on a miss while
   a hit does more work — that timing difference is itself an oracle even if
   the response bodies are made identical.
3. **CAPTCHA escalation** after a small number of misses from one source.
4. **Never return the phone number back**, masked or otherwise. Return only a
   masked *email* hint, which is what the OTP is actually sent to.

### Option B — Blind branch (recommended)

Never answer "does this exist". Always send an OTP, and branch **after**
verification, when the person has already proved control of the identifier.

```
POST /api/auth/begin
Body:     { "identifier": "9443947853" }
200:      { "sent": true, "channel": "sms", "hint": "94***53" }   // ALWAYS, existent or not

POST /api/auth/continue
Body:     { "identifier": "...", "otp": "123456" }
200 existing → { "next": "password", "user_hint": {...} }   // or a full Token, see below
200 new      → { "next": "register", "registration_token": "<5-min action token>" }
401          → { "detail": "That code is not right or has expired." }
```

- The response to `/begin` is **byte-identical** whether or not the account
  exists. No oracle.
- An attacker learns nothing without possessing the phone. The cost of probing
  becomes "control the number", which is the whole point.
- `registration_token` is a purpose-scoped action token exactly like the
  existing `device_evict` one (`auth.py:117`), so the create-account form does
  not re-verify the number.

**Costs, stated plainly:** every probe sends a real SMS, so rate limiting is
*still* required — here to control spend and prevent SMS-bombing a stranger's
phone, not to prevent enumeration. Suggested: 3 per identifier per hour, 10 per
IP per hour. And an OTP is sent before the customer has typed a password, which
is one extra step for returning users.

### 2.1 Interaction with the existing two-step OTP

Option B **replaces** the ordering rather than sitting beside it. Today:
`identifier + password → OTP → token`. Under B: `identifier → OTP → password (existing) or register (new)`.

The OTP moves *earlier*. That is a real change to the sequence and the backend
owner should be explicit about which one `verify-login-otp` keeps serving
during a transition — I would keep both live and migrate the frontend last.

Option A leaves the existing two-step flow completely untouched; `/identify` is
purely additive, which is its main argument.

### 2.2 Interaction with the 409 `device_limit`

**Unchanged under either option, and this matters.** The cap is enforced at
session creation, which is the last step of whichever path is taken. So the 409
still arrives after identity is proven, and `evict-and-login` still completes
it. Both new flows must therefore handle a 409 at their final step — see §3.

One thing the backend owner must confirm: `evict-and-login` calls
`_create_session_or_409` again after revoking. If two tabs raced, that second
call could itself 409. It is a narrow race, but the endpoint would return a 409
whose `pending_token` the frontend must then use again. Worth making explicit
in the contract.

### 2.3 What is achievable frontend-only today — the interim

**A genuinely progressive-feeling flow, with no new endpoint and no new leak:**

1. **Screen one** — one field, "Phone or email", and Continue. No type toggle;
   `_find_user` already accepts both.
2. **Screen two** — the identifier is shown back as a quiet caption with an
   Edit affordance, and the password field takes focus. Submit calls
   `send-login-otp` exactly as today.
3. **On 401** — the existing uniform "Incorrect email/phone or password" is
   shown *and* a "Create an account with this number" action appears, carrying
   the identifier into `/auth/register` pre-filled.
4. **Screen three** — OTP, calling `verify-login-otp`.

This delivers the single-field entry, the branch to registration, and the
no-dead-ends requirement. What it cannot do is skip the password for a new
customer — they type one wrong password before being offered registration.
That is the entire gap, and it costs nothing in security to live with.

**I can build this today against current contracts.** Say the word.

---

## Part 3 — Device & session handling

### 3.1 In-flow eviction (the sign-in interruption)

The contract already supports everything needed; nothing is missing. Design:

- The 409 does **not** navigate. It resolves in place, on the sign-in surface,
  in the same visual language — no modal that looks borrowed, no bounce to
  another page, no "back to home".
- Copy leads with the situation, not the error: *"You're signed in on four
  devices. Sign one out to continue on this one."*
- Each device renders as a recognisable row: `device_name` + `os_name` +
  `browser_name` as the title, `location` beneath, and `last_active_at` as
  relative time ("active 2 hours ago") with the absolute date in a `title`.
  `device_type` picks the row's label — Phone / Tablet / Computer — which is
  what a person actually recognises.
- **The current device is not in the list** (it has no session yet), so there
  is no risk of signing yourself out to sign yourself in. Worth saying in the
  UI: *"This device isn't listed yet — it's the one you're adding."*
- Choosing a device calls `evict-and-login` and lands the customer where they
  were going. One action, no re-authentication.
- **Focus management**: choosing a device removes the row that had focus — the
  same defect fixed in the cart. Focus moves to the section heading.
- **`aria-live`**: the eviction result is announced; nothing navigates.
- **Token expiry**: `pending_token` lasts 5 minutes. If it has expired,
  `decode_action_token` returns 401 "This request has expired. Please try
  again." The UI must catch that specific case and return to step one with the
  identifier retained, not show a raw error.

**Nothing blocks this. It can be built as soon as the sign-in rebuild lands.**

### 3.2 The account sessions surface

`GET /api/auth/sessions` and `DELETE /api/auth/sessions/{id}` already exist, so
**this is fully buildable frontend-only, today.**

- Lives at `/account`, as its own section: "Devices signed in".
- Same row design as §3.1, plus a **"This device"** marker on the current
  session so nobody signs themselves out by accident.
- Each row individually revocable. Revoking the current session signs you out
  and returns you to sign-in — that must be confirmed first, and worded as what
  it is: *"Sign out this device? You'll need to sign in again."*
- Focus lands on the section heading after a removal; the change is announced.

### 3.3 What is missing: sign out everywhere

There is **no bulk-revoke endpoint**. Doing it client-side as N × `DELETE` is
wrong for the one case that matters — a customer who thinks their account is
compromised — because it is not atomic, it races the sliding-session refresh in
`api.ts`, and a partial failure leaves them believing they are safe when they
are not.

```
POST /api/auth/sessions/revoke-all
Body:     { "except_current": true }
200:      { "revoked": 3 }
```

Should revoke in a single transaction. If `except_current` is false it must
also invalidate the caller's own token.

### 3.4 Summary of backend asks

| # | Ask | Priority | Why |
|---|---|---|---|
| 1 | **Rate limiting on all auth endpoints** | **Highest** | None exists. Independent of everything else here. |
| 2 | Fix `/forgot-password` to return one identical response either way | **High** | The mitigation is commented but not implemented. |
| 3 | **R3** — always run bcrypt on `send-login-otp`, even with no user | High | The short-circuit makes a missing account answer ~1000x faster. The real oracle. |
| 4 | `POST /sessions/revoke-all` | Medium | Needed for a credible "sign out everywhere". |
| 5 | `POST /auth/begin` + `/auth/continue` (Option B) **or** `/auth/identify` (Option A) | Medium | Progressive sign-in. Only after 1–3. |
| 6 | Confirm the `evict-and-login` re-409 race behaviour | Low | Contract clarity. |

**Items 1–3 are worth doing on their own merits even if progressive sign-in is
never built.** Item 1 in particular is a live exposure today.

---

## Part 3.5 — Remediation, prioritised and actionable

For the backend owner. Each item gives the endpoint, the current behaviour, and
the change. **None of this has been made — spec only.**

### A correction to §1.2, finding 3

My first pass claimed the two 403 branches in `send-login-otp` (deactivated,
unverified) leak account existence. **That was wrong and I am withdrawing it.**
Read the order:

```python
user = _find_user(db, payload.identifier)
if not user or not auth_utils.verify_password(payload.password, user.password_hash):
    raise HTTPException(401, "Incorrect email/phone or password. …")
if not user.is_active:
    raise HTTPException(403, "Your account has been deactivated. …")
if not user.is_verified:
    raise HTTPException(403, "Please verify your account first — …")
```

Both 403s sit **after** a successful password check. An attacker who reaches
them already holds valid credentials, so they confirm nothing that person did
not already know. They are not an enumeration vector, and fixing them is not a
priority.

**However, the same two lines contain a worse oracle than the one I withdrew.**
See R3.

---

### R1 — No rate limiting on any auth endpoint  ·  **Priority: highest**

**Current:** nothing. Searched for `slowapi`, `limiter`, `RateLimit` — no
match anywhere outside `venv/`. Every auth endpoint answers as fast as the
server can.

**Why it is first:** every other item here is a leak of *one bit per request*.
Rate limiting is what decides whether one bit per request is a curiosity or a
customer list. It is also the only item that helps even if nothing else is
touched.

**Change:** add `slowapi` (works with the installed `fastapi==0.110.0`), keyed
on client IP, applied to `send-login-otp`, `verify-login-otp`,
`forgot-password`, `reset-password`, `register`, `verify-register-otp`,
`resend-register-otp`, and `sessions/evict-and-login`.

```python
# main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

```python
# routers/auth.py  — request: Request must be in the signature for slowapi
@router.post("/send-login-otp")
@limiter.limit("5/minute;30/hour")
def send_login_otp(request: Request, payload: schemas.UserLogin, db: Session = Depends(get_db)):
```

Suggested budgets: `send-login-otp` and `forgot-password` 5/min and 30/hour;
`verify-login-otp` and `reset-password` 10/min (legitimate typos are common);
`register` 3/min.

**Per-IP alone is not enough** — a proxy pool defeats it. Add a second limit
keyed on the *identifier* for `send-login-otp` and `forgot-password`
(≈5/hour per identifier), which is what stops a distributed walk of the number
space. Behind Render's proxy, `get_remote_address` reads the socket peer, so
also trust `X-Forwarded-For` or every request will share one key.

---

### R2 — `/forgot-password` reveals whether an account exists  ·  **High**

**File:** `routers/auth.py:348`

**Current** — the comment states the intent and the code does the opposite:

```python
user = _find_user(db, identifier)
if not user:
    # Don't reveal if user exists — just return success
    return {"message": "If this account exists, an OTP has been sent."}

otp = _create_otp(db, user.email, otp_type="reset")
notifications.send_password_reset_otp_email(user.email, user.full_name, otp)
return {
    "message": f"OTP sent to your registered email ({user.email[:3]}***). Valid for 10 minutes.",
    "email_hint": user.email[:3] + "***@" + user.email.split("@")[-1],
}
```

Two different messages, and only one carries `email_hint`. One request answers
"is this number a customer".

**Correct:** one response shape on both paths.

```python
user = _find_user(db, identifier)
if user:
    otp = _create_otp(db, user.email, otp_type="reset")
    notifications.send_password_reset_otp_email(user.email, user.full_name, otp)

# Identical on both paths — no email_hint, no branch in the message.
return {"message": "If an account exists for that phone or email, we've sent a code to its registered email address."}
```

**Frontend consequence, and it is not cosmetic:** the reset screen currently
shows `email_hint` so the customer knows *which* inbox to check. Removing it
means the copy must carry that instead — "check the email address registered to
this account". I will make that change on the frontend when this lands; the two
have to ship together or the screen will read as broken.

---

### R3 — The bcrypt short-circuit is a timing oracle  ·  **High**

**File:** `routers/auth.py:389`

**Current:**

```python
if not user or not auth_utils.verify_password(payload.password, user.password_hash):
```

Python short-circuits `or`. When `user` is `None`, `verify_password` **never
runs** — so a missing account returns in microseconds, while a real account
with a wrong password pays a full bcrypt verification (~100ms by design).

The response bodies are correctly identical. The *response times* differ by
three orders of magnitude, and that difference is stable, easy to measure
remotely, and needs no credentials. **This is the real enumeration vector on
this endpoint** — the one I mistakenly attributed to the 403s.

**Correct:** always pay the hash. Verify against a fixed dummy hash when the
user is absent, so both paths cost the same.

```python
# Module level — computed once at import.
_DUMMY_HASH = auth_utils.hash_password("not-a-real-password")

user = _find_user(db, payload.identifier)
# Always run a verification, even with no user, so the timing is flat.
password_ok = auth_utils.verify_password(
    payload.password, user.password_hash if user else _DUMMY_HASH
)
if not user or not password_ok:
    raise HTTPException(401, "Incorrect email/phone or password. Please check and try again.")
```

The same pattern applies anywhere else a lookup gates an expensive check.

---

### R4 — `_find_user` returns at different speeds  ·  **Medium**

**File:** `routers/auth.py:33`

**Current:** an email identifier hits an indexed equality on `email`; a phone
goes through `_normalize_phone` first and then queries `phone`. A miss returns
on the first query; a hit continues into whatever the caller does next.

On its own this is a much smaller signal than R3 — both branches are one
indexed query. It matters in one specific case: **if R3 is fixed but the
endpoint still returns before doing equivalent work on the miss path**, the
residual difference becomes the next-best oracle. Fixing R3 as written above
handles `send-login-otp`. Any *new* endpoint (Option A's `/identify`, if you
choose it) must be written the same way from the start — do the same work on
both paths, then branch on the result at the end.

**This is only load-bearing for Option A.** Under Option B there is no
existence-answering endpoint, so there is nothing to time.

---

### R5 — `POST /sessions/revoke-all`  ·  **Medium**

As specified in §3.3. Needed for a credible "sign out everywhere"; must revoke
in one transaction.

---

### R6 — Progressive sign-in endpoints  ·  **After R1–R3**

Option B: `POST /auth/begin` + `POST /auth/continue`, per §2. Should not be
built before R1 is in place, because R1 is what bounds the SMS spend the blind
flow implies.

---

### Ordering

R1 → R2 → R3 → then R5/R6 as scheduling allows. R4 only if Option A is chosen.
R1–R3 are worth doing whether or not progressive sign-in is ever built.

---

## Part 4 — What I will build without waiting

Against current contracts, no backend change:

1. Sign in / sign up / forgot password rebuilt in the new design.
2. The §2.3 interim progressive flow — single field, identifier carried into
   registration on failure.
3. The §3.1 in-flow device eviction, replacing the current modal.
4. The §3.2 account sessions surface with individual revocation.

Held until you decide: anything needing items 1–6 above.
