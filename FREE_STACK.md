# Running both shops on a permanently free stack

Written after the Render suspension took both shops offline mid-month. The goal
here is a stack with **no sudden suspension and no monthly hour cap** — and an
honest account of the one part of the request that cannot be met.

---

## The short version

| Layer | Service | Free forever? | Cap that matters |
|---|---|---|---|
| Frontend | Vercel Hobby | Yes | 100 GB bandwidth/month — far above this traffic |
| Database | Neon free | Yes | 0.5 GB storage, no time limit, no suspension |
| Backend | Oracle Cloud **Always Free** | Yes | None. 4 vCPU / 24 GB ARM, always on |
| Email (OTP + all notifications) | Brevo free | Yes | 300/day = ~9,000/month |
| Media | Cloudinary free | Yes | 25 GB storage / 25 GB bandwidth |
| **SMS** | — | **No. See below.** | — |

---

## The part that cannot be free: SMS

**Global unlimited free SMS does not exist, from any provider.**

This is not a matter of finding the right tool. Every SMS is delivered by a
mobile carrier, and carriers charge the sender per message — roughly ₹0.15–2.00
in India and more internationally. Any service advertising "free SMS" is a
time-limited trial, a tiny monthly allowance, or is about to stop.

Twilio is not the problem and switching away from it will not make SMS free.
Its trial credit runs out because the messages genuinely cost money.

### What to do instead

**Send notifications and OTP by email.** Email is genuinely free at this
volume, works globally with no per-message cost, and is what most shops
actually rely on for receipts and codes.

**This code already does it.** `notifications.py` has a three-tier email
fallback — Brevo, then SendGrid, then Gmail SMTP — and none of it touches
Twilio. Registration sends the OTP by email *and* SMS; password reset is
email-only. So removing Twilio leaves every OTP still arriving.

**If WhatsApp matters**, use Meta's WhatsApp Cloud API directly rather than
through Twilio. Meta gives 1,000 free service conversations a month and
customer-initiated conversations are free. That is cheaper than any reseller,
though business-initiated template messages still cost.

---

## Backend: why Oracle Cloud Always Free

The Render suspension happened because its free tier shares **750 instance
hours across the whole workspace**, not per service. Three services running
continuously exhaust that in about ten days.

Oracle's Always Free tier has **no hour cap**. It is a real virtual machine
that stays on: up to 4 ARM cores and 24 GB of RAM, which is far more than this
API needs. Being a VM it takes more setup than a push-to-deploy host, and the
`backend/Dockerfile` in this repo removes most of that work.

Alternatives if a VM is unwanted:

- **Google Cloud Run** — 2 million requests/month free, scales to zero, cold
  start of 1–3 seconds rather than Render's 50. Needs a billing account on
  file, but stays inside the free tier at this volume.
- **Fly.io** — small always-free allowance, Singapore region.
- **Koyeb** — free tier covers one service; two shops need two accounts.

---

## What to do, in order

1. **Back up the database.** `cd backend && python scripts/backup_db.py`
2. **Move the database to Neon** if it is not already there. Free, no expiry.
3. **Deploy the backend** to Oracle Always Free or Cloud Run using
   `backend/Dockerfile`. Copy every environment variable across —
   `startup_checks.py` refuses to boot if a critical one is missing.
4. **Set `BREVO_API_KEY`** so email has a real sender. Verify the shop's domain
   with Brevo so mail comes from the shop rather than a generic address.
5. **Drop Twilio** once email is confirmed working. `TWILIO_ACCOUNT_SID` and
   `TWILIO_AUTH_TOKEN` can simply be left unset; the SMS and WhatsApp helpers
   already no-op when they are absent.
6. **Point `NEXT_PUBLIC_API_URL`** in Vercel at the new backend URL.
7. **Delete unused services** and **pause uptime monitors** on anything still
   on a metered free tier — a monitor pinging every five minutes is what
   prevents a free instance from ever sleeping.

---

## What "no limits" realistically means

Every free tier has some limit; the difference is whether hitting it suspends
the service. The stack above is chosen so the limits are **storage and
bandwidth**, which grow slowly and warn in advance, rather than **instance
hours**, which run out on a schedule and suspend without warning.

At this shop's volume none of those limits are close. The one that would arrive
first is Brevo's 300 emails/day, and that is roughly 9,000 notifications a
month — well beyond current order volume, and it degrades to Gmail SMTP
automatically rather than failing.
