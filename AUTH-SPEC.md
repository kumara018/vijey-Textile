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

2. **`/send-login-otp` is mostly correct** — a missing user and a wrong password
   both return the same 401 ("Incorrect email/phone or password"). But two
   branches below it break the tie: a deactivated account returns **403
   "Your account has been deactivated"**, and an unverified one returns **403
   "Please verify your account first"**. Both confirm the account exists.

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
| 3 | Make the 403 deactivated/unverified branches non-distinguishing on `send-login-otp` | High | They defeat the uniform 401 above them. |
| 4 | `POST /sessions/revoke-all` | Medium | Needed for a credible "sign out everywhere". |
| 5 | `POST /auth/begin` + `/auth/continue` (Option B) **or** `/auth/identify` (Option A) | Medium | Progressive sign-in. Only after 1–3. |
| 6 | Confirm the `evict-and-login` re-409 race behaviour | Low | Contract clarity. |

**Items 1–3 are worth doing on their own merits even if progressive sign-in is
never built.** Item 1 in particular is a live exposure today.

---

## Part 4 — What I will build without waiting

Against current contracts, no backend change:

1. Sign in / sign up / forgot password rebuilt in the new design.
2. The §2.3 interim progressive flow — single field, identifier carried into
   registration on failure.
3. The §3.1 in-flow device eviction, replacing the current modal.
4. The §3.2 account sessions surface with individual revocation.

Held until you decide: anything needing items 1–6 above.
