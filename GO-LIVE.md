# Going live — what is done, and the four things only you can do

Everything in section A is finished and verified. This document is section B:
the items that need your hands, your accounts, or your judgement, written so
you can work through them without having to reconstruct any context.

---

## 1. The declined-card checkout test

**Why it has to be you.** It needs real Razorpay credentials against the live
backend, and your standing rule is that checkout gets a live-backend pass with a
real declined card before cutover. I can't hold those credentials and shouldn't.

**Why it matters more than a successful payment.** The success path is exercised
constantly. The *failure* path is the one that decides whether a customer who
was declined ends up with money taken and no order, or an order with no money.
The code already handles it — `_refund_uncredited_payment` in
`backend/routers/orders.py` refunds when stock ran out between payment and
order creation — but that has never been run against the real gateway.

**Steps**

1. Put Razorpay in **Test Mode** and use the card `4000 0000 0000 0002`
   (Visa, always declined). Any future expiry, any CVV.
2. Add one item to the cart and go through checkout to the Razorpay modal.
3. Enter the declined card and submit.

**What must happen**

| Check | Expected |
|---|---|
| The page | An error you can read, not a spinner and not a blank screen |
| The cart | **Still has the item.** A declined payment must not empty it |
| My Orders | **No order.** Not a pending one, not a failed one — none |
| Admin → Orders | Nothing new |
| Stock | Unchanged on the product |
| Razorpay dashboard | The payment shows as failed, and nothing is captured |

**If any row is wrong, do not go live.** Send me the request id — every response
now carries `X-Request-ID`, and the backend log line for that exact request will
say what happened.

4. Then repeat with a **successful** test card (`4111 1111 1111 1111`) and check
   the mirror image: order created, cart emptied, stock decremented once (not
   twice), confirmation email sent.

---

## 2. Confirm the Vercel environment

**What I could verify from here.** The build itself, which is the thing that
actually matters:

```bash
cd frontend && npm run check:api-base
```

It reads the origins compiled into the shipped JavaScript and reports which
backend the build talks to. On the current build:

```
API origin in this build : https://vijey-textile.onrender.com
OK — this build talks to the production backend.
```

`next.config.js` inlines `NEXT_PUBLIC_API_URL || <render url>` at build time, so
even with the variable unset the build is correct. The check fails loudly if a
build ever ships with no production origin — which would look perfect in CI and
be a completely dead shop.

**What is still yours:** setting `NEXT_PUBLIC_API_URL` explicitly in Vercel, so
the value is deliberate rather than relying on a fallback constant.

---

## 3. Review the preview

Everything is on `feat/3d-platform`. To see it exactly as it will ship:

```bash
cd frontend && npm run build && npx next start -p 3100
```

Worth looking at specifically, because these changed most:

- **The homepage hero.** The image sequence is gone; the camera move is rendered
  live. Scroll slowly through the opening — the shake you recorded was frame
  stepping, and there are no frames left to step.
- **The ground colour.** Every `ink`/`night` value moved one rung darker.
  #1C1917 is still in the system as the *raised* surface; the ground is #121010.
- **A product page**, to confirm the images load. I broke this with the CSP and
  fixed it; it is now checked automatically, but I would like your eyes on it.

---

## 4. The word to merge

`feat/3d-platform` → `main` is yours to give. Nothing has gone near production.

---

## Running the gates yourself

With the backend on :8000 and the production build on :3100:

```bash
cd frontend && npm run check:csp && npm run check:hero-matrix && npm run a11y && npm run measure && npm run check:api-base
```

```bash
cd backend && python -m pytest tests/ -q && python loadtest.py --users 50 --seconds 20
```

---

## Two things I did not do, and why

**The hero image sequence is still in the repo.** 540 frames, about 37MB, in
`frontend/public/hero/`. Nothing fetches them any more except the poster in each
tier directory — the sequence hero is gone. Deleting them would cut the deploy
by 37MB, but it also deletes the offline render pipeline that produced the
posters, and that is a bigger decision than a cleanup. Say the word and I will
strip the frames and keep the posters.

**The seeded catalogue has broken image paths.** `backend/seed_data.py` stores
`/images/placeholder-frock.jpg`, a path neither service has ever served, so all
24 seeded products would show a broken image. The card now degrades to a
composed placeholder instead of a broken-image glyph, so it is no longer ugly —
but if those seeded rows exist in the production database they are 24 products
with no photograph, and that is a data question rather than a code one.
