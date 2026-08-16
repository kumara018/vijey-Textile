# Final audit — Vijey Textile, `feat/3d-platform`

Everything below is measured on this machine, in a real GPU-backed headless
Chrome, against a production build. Where a number could not be measured, it
says so rather than carrying an estimate.

---

## 1. Scene ownership

The most misread number in a 3D site's performance table is frame rate on a
route that has no scene. There is **one** `<Canvas>` in this application. It is
mounted in the root layout, it survives every navigation, and `ThreeProvider`
decides per route whether anything is rendered into it.

So each route is one of three things, and the audit says which:

| | meaning |
|---|---|
| **OWNS** | a live scene is mounted and drawing on this route |
| **inherits** | no scene; the route sits on the shared static ground |
| **suppressed** | a scene exists for this path but is deliberately not mounted |

**Route → scene** (`src/store/useSceneStore.ts:93`):

| path | scene | notes |
|---|---|---|
| `/` | `entrance` | **suppressed** — the pre-rendered sequence *is* the hero |
| `/products` | `gallery` | |
| `/products/[id]` | `chamber` | full cinematic chain |
| `/cart`, `/wishlist` | `vault` | |
| `/checkout` | `terminal` | **restrained** — capped regardless of device |
| `/orders`, `/account`, `/returns` | `records` | **restrained** |
| `/auth/*` | `gate` | **restrained** |
| everything else, incl. `/admin/*` | `plain` | **restrained** — quietest ground |

Two independent gates sit above that map, and both are the reason most routes
report `inherits` rather than a frame rate:

1. **`profile.realtime` is false below the `rich` rung.** On a laptop iGPU the
   tier ladder commonly resolves to `standard`, and no scene mounts at all —
   anywhere. This is the intended behaviour, not a degraded one.
2. **`/` is suppressed even at `maximum`.** The live entrance scene and the
   scroll-scrubbed sequence stage the same hero garment, and at a wide viewport
   both mounted at once — the same photograph on screen twice. The sequence
   wins because it was rendered offline with the full postprocessing chain at a
   quality the real-time path cannot afford on a customer's GPU.
   (`ThreeProvider.tsx:196`. The one exception is `?capture=1`, where the scene
   is the subject being photographed.)

A route that inherits reports **no** draw calls, not zero. "Nothing to draw" and
"drew nothing" are different facts and the table keeps them apart.

---

## 2. Per-route measurement

`npm run measure` — 3s window per route, frames counted on `requestAnimationFrame`
so the figure is presented frames, not a timer's opinion. Run twice, once per
adapter.

_(filled from the run — see §6 for the raw output)_

---

## 3. Deliberate-failure drills

`npm run drills`. Each one breaks the page on purpose. The bar is not "no
crash": it is that the shop still works, because every 3D layer here is
decoration behind ordinary HTML and the whole architecture is a bet on that.

Run against the dev server with the real FastAPI backend live (24 products),
in GPU-backed headless Chrome. **6 / 6 passed.**

| # | drill | body text | links | canvas | headline survived |
|---|---|---|---|---|---|
| 1 | network killed mid-load | 2955 | 57 | 1 | ✅ |
| 2 | forced WebGL context loss | 2955 | 57 | 1 | ✅ |
| 3 | WebGL disabled entirely | 2955 | 57 | 1 | ✅ |
| 4 | throttled to slow 3G | 2386 | 48 | 1 | ✅ |
| 5 | poster / sequence blocked | 2955 | 57 | 1 | ✅ |
| 6 | API killed (`/products`) | 1466 | 38 | 0 | ✅ states the failure |

The "1 canvas" under drill 3 is not a contradiction: that is `SequenceHero`'s
**2D** canvas, which is what the scrub draws into. No WebGL context exists on
that run, and the page is unchanged — which is the result the tier ladder
exists to produce.

Drill 6 stands in for "API killed mid-checkout". Checkout proper needs a
signed-in session and a live Razorpay handle, so the automated drill blocks the
API origin and asserts the storefront **states** the failure rather than showing
an empty grid. The money path itself is covered by the live-backend pass with a
real declined card — a human test, recorded as one rather than faked here.

### Two corrections made to the drills themselves

Drill 6 failed on its first run and **the fault was the drill's**. `/products`
retries once after `retryDelay: 10_000`; the drill waited 6s, so it sampled a
page that was still legitimately retrying and reported a still-loading state as
a silent one. `ErrorState` does carry `role="alert"`. Fixed by giving each drill
its own settle time — the drill asks *whether* the site speaks, not how fast.

**Open UX question, recorded rather than silently changed:** with the API down, a
customer watches a skeleton for **10 seconds** before being told anything, and
the delay is flat rather than exponential backoff. Retrying once, slowly, is
defensible — it does not hammer a struggling server — but the silence is long
against a standard that asked for backoff. `/products` is already rebuilt and
reviewed, so this is flagged for a decision rather than changed unilaterally.

---

## 4. Keyboard pass

`npm run a11y`. Tabs from the top of each route to the end, recording focus
order and asserting: every focused element draws a visible indicator, tabbing
terminates (no trap), and no action is unreachable.

Focus *order* is printed rather than asserted — the correct order is a
judgement about the page, not something a script can know.

**Result: clean on every route tested.**

| route | tab stops | focus indicators | trap |
|---|---|---|---|
| `/` | 82 | all visible | none |
| `/products` | 42 | all visible | none |
| `/about` | 38 | all visible | none |
| `/support` | 45 | all visible | none |
| `/auth/login` | 5 | all visible | none |
| `/cart` | 33 | all visible | none |

`/auth/login` having 5 stops is the stripped auth chrome working as specified:
logo, the field, the action, and nothing else to tab through.

**A correction to this script too.** It first reported `/products` as
"TAB ORDER DID NOT TERMINATE" when it had merely exhausted its own 60-tab
budget — the route terminates cleanly at 42. A focus trap (the same element
receiving focus repeatedly) and an exhausted budget are now reported as the
different things they are. A gate that cries wolf is worse than no gate.

---

## 5. Reduced-motion pass

Same script, relaunched with `--force-prefers-reduced-motion`. Asserts that
after everything settles, `document.getAnimations()` reports nothing running.
That call covers CSS animations, transitions and the Web Animations API in one
go, which is the only way to catch motion a stylesheet media query never reached
— a JS-driven tween does not care what the CSS says.

**This pass failed first, and the failure was real.** With
`prefers-reduced-motion: reduce` forced at the browser level, `/` had **10**
animations still running and `/products` had **3** — all of them `animate-pulse`
on loading skeletons.

The shared `Skeleton` in `components/system/States.tsx` carries
`motion-reduce:animate-none` and always did. The inline skeletons that grew up
beside it — the products grid, the heirloom plate, the legacy admin tables —
did not. Patching those call sites would have fixed today and not tomorrow,
because the guarantee would still rest on whoever writes the next skeleton
remembering a utility class.

So it is stated once, in `globals.css`, where a pulse or a spinner cannot escape
the preference no matter where it is written. Scoped to the decorative loading
animations deliberately: a blanket `* { animation: none }` also kills animations
whose `animationend` drives application logic, trading a motion bug for a stuck
interface.

**After the fix: zero animations running on every route.**

---

## 6. Homepage: four defects found by looking

All four were invisible to `tsc` and to the build. Each was found by putting the
page in a real compositing browser and measuring it, not by reading the code.

**1. The headline drove itself through the header.** `text-plate` was
`clamp(2.9rem, 9.4vw, 9.6rem)` — sized on width alone. At 1920×845 that is
~154px; the sentence wrapped to four lines ≈553px and the block wanted ~640px of
the ~567px between header and fold. A `justify-end` column overflows *upward*, so
the first line landed behind the wordmark. Width-only hero type will always do
this eventually because it cannot know the screen is short. Now
`min(9.4vw, 12.2vh)` — measured live at 87.84px on a 720px viewport, which is
12.2vh exactly. The vertical rhythm around it is height-aware too.

**2. "See every piece" had silently disappeared.** `Reveal` observes with
`rootMargin: '0px 0px -12% 0px'` so a reveal *starts* just before content arrives
from below. The call to action measured `top: 645` against an effective bottom
edge of 633.6 — permanently inside the excluded band. And since the hero became
`sticky`, that copy never moves for the whole 240svh section, so it could never
cross the line. Pinning the hero broke the assumption the heuristic rested on.
Content already on screen at first paint now reveals immediately.

**3. A hydration mismatch on the poster.** `useDeliveryTier` branched on
`typeof window`, so the server emitted `/hero/standard/poster.avif` and the
client's first render wanted `/hero/light/`. React keeps the *server's*
attributes on a mismatched node, so the poster could point at a directory the
ladder is not loading frames from — the sequence would scrub against a still from
another rung. The guess now happens once, in the effect.

**4. `inert=""` on the closed nav overlay.** The React 18 idiom; React 19 reads
an empty string as **false**, which would have left the closed overlay
keyboard-focusable.

---

## 7. Raw output

_(appended from the runs)_
