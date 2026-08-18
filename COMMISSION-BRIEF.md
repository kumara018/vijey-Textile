# Vijey Textile — Commission Brief

Two commissions, specced so they can be sourced in parallel. Photography first:
it improves every surface immediately (listing, detail, cart line items, order
history, email) and it is the cheaper, faster, lower-risk half. The 3D garment
work only pays off on hero moments.

**Nothing here is engaged.** Costs need sign-off before anyone is booked.

---

## Why photography leads

The site's identity is a **warm near-black ground (#1C1917), off-white type
(#FAFAF9), and muted brass (#A16207) as the only accent**. Every garment
photograph is the sole source of colour in its frame. That only works if the
photography is lit to match the 3D scenes — same key direction, same colour
temperature, same fall-off — so a rendered frame and a photographed frame can
sit next to each other and read as one world.

The current catalogue photography is flat-lit product-on-white. It is honest and
functional, and it is the single biggest thing holding the design back. No
amount of grading rescues a flat-lit source: the shadow information simply is
not in the file.

---

# 1. Product photography

## Technical brief — non-negotiable, these make the grade work

| Parameter | Specification | Why |
|---|---|---|
| **Key direction** | Camera-left, ~35–40° above the garment, raking across the cloth | Matches `EntranceScene` directional light at `[-3.2, 4.6, 3.0]`. A key from the other side makes photography and render irreconcilable. |
| **Colour temperature** | 5200–5600K, consistent across the whole shoot | The film LUT warms the shoulder and cools the toe. Mixed temperatures fight it and go green in the mids. |
| **Key : fill ratio** | 4:1 to 6:1 | Deep enough for the ground, not so deep the weave is lost in shadow. Flat lighting has nothing to grade. |
| **Background** | Seamless #1C1917 to near-black, unlit or barely lit | Lets the garment sit in the site's ground with no cut-out. Also enables real depth staging. |
| **Rim / separation** | Subtle warm rim from behind-right, ~1/8 key | Separates the silhouette from the dark ground — the god-ray source sits behind the subject in-scene. |
| **Format** | RAW, 45MP+ full-frame or medium format | The `maximum` rung is 3840px wide. Anything less is upscaled. |
| **Colour space** | Deliver ProPhoto or AdobeRGB 16-bit; sRGB derivatives on request | Grading headroom. sRGB-only clips before the LUT is applied. |
| **Retouch** | Dust and thread removal only. **No skin smoothing, no colour "punch", no background replacement** | The grade is applied in-engine. Pre-graded files double-apply and go plastic. |
| **Delivery** | Layered TIFF/PSD with garment on transparency **plus** flat composite | Transparency enables true depth-layer staging with light passing between layers. This is the single most valuable deliverable. |

### Shot list — per hero garment (6 pieces to start)

1. **Hero full-length** — garment on stand or model, full drape visible, vertical 4:5. *This is the homepage subject.*
2. **Drape detail** — mid-skirt, raking light across the weave, showing sheen travel. Horizontal.
3. **Border / zari macro** — 1:1 or closer on the gold border, so the metal reads as metal.
4. **Neckline / embroidery macro** — Aari knots, mirror work, thread texture.
5. **Movement frame** — garment in motion, ~1/60s, showing volume and fall.
6. **Scale reference** — on model, three-quarter, establishing how it sits on a child.

### Category coverage — 6 garments minimum

One per category so no page group is left with legacy flat-lit imagery:
Baby Frocks · Chudithar · Frocks · Western Dresses · Lehenga · Party Wear.

### Crew

Photographer with **product/fashion** credits (not event or portrait), stylist
for garment prep and pinning, art director to hold the brief across the day,
one child model plus guardian, one stand/mannequin set. One studio day covers
6 garments at 6 setups if the lighting stays fixed and only the garment changes
— which is also what keeps the look consistent.

### What I need back to integrate it

- RAWs plus layered TIFFs with transparency
- A grey-card / colour-checker frame per lighting setup
- Written confirmation of the key position and colour temperature actually used

---

# 2. Authored 3D garments

Only worth commissioning **after** photography lands, and only for pieces that
stay in the catalogue long enough to amortise. A seasonal SKU does not.

### Scope — 3 evergreen hero pieces

| Piece | Why it needs authoring rather than photography |
|---|---|
| **Lehenga** | The drape is the product. A camera move around real fall-and-swing is the shot, and it cannot be photographed as a sequence. |
| **Dupatta** | Sheer layering and light transmission through overlapping fabric. Photography flattens the depth; simulation keeps it. |
| **Party-wear frock** | Volume and skirt bounce under motion. |

### Tooling — as specified

- **Marvelous Designer** — cloth simulation. General-purpose cloth solvers do not convince on lehenga drape, dupatta sheerness or frock volume; MD's pattern-based approach does, because the garment is built from actual panels and seams.
- **Substance 3D** — fabric materials: real weave at texel density, anisotropic sheen direction aligned to the warp, zari as a separate metallic with its own roughness map. **The anisotropy direction must match the weave**, or the sheen band travels the wrong way across the cloth and reads as plastic.
- **Blender** — scene assembly, camera move, lighting to match the photographic key above.
- **Photogrammetry / flatbed fabric scanning** — from **actual Vijey inventory**. For weave and zari, capture beats authoring outright: scan the real bolt at 1200dpi and you have the true thread structure rather than a procedural approximation.

### Deliverables

- Source `.zprj` (Marvelous), `.blend`, Substance graphs — not just bakes, so the work can be re-rendered later
- GLTF + Draco/Meshopt export for any real-time use
- 4K KTX2 textures: basecolor, roughness, normal, anisotropy direction, metallic mask for zari
- Rendered frame sequences per the pipeline below

---

# 3. Path-traced rendering — the `maximum` rung

**Currently not path-traced, and I will not call it that.** The `maximum` rung
today is offline renders of the existing real-time scene at 3840px with the full
postprocessing chain forced open. Good, reproducible, and honestly an
approximation.

Path tracing replaces approximation with computation:

| Real-time approximation | Path-traced |
|---|---|
| Screen-space AO | True global illumination |
| Bloom threshold on speculars | Real caustics through sheer fabric |
| Analytic anisotropic sheen | Measured BSDF response on silk |
| Shadow map | Accurate soft shadows from area lights |
| Depth-of-field blur pass | Real lens defocus with correct bokeh |

**Cost profile is the point: this costs nothing at runtime.** The visitor
downloads frames either way. All the expense moves to a render farm, once.

- **Blender Cycles** is sufficient and keeps the toolchain open-source.
- **Octane/Redshift** only if GPU-hour pricing beats Cycles at the sample counts silk actually needs — sheer fabric is slow to converge and that is where the money goes.
- High sample counts, then denoise. Encode down per rung afterwards — the existing `encode-sequence.mjs` already does this and needs no change.

**Pipeline impact: none.** `render-sequence.mjs` is replaced by a render-farm
output directory. `encode-sequence.mjs`, the tier ladder, and `SequenceHero`
all work unchanged. Frames are a file drop.

---

## Sequencing

1. **Photography** — one studio day, 6 garments. Improves every page immediately.
2. **Integrate** — re-shoot assets replace catalogue images; hero staging uses the transparency deliverable.
3. **3D garments** — 3 evergreen pieces, after photography proves the look.
4. **Path-traced frames** — once garments exist to trace.

Stages 1 and 2 deliver most of the visible gain. Stages 3 and 4 are what make
the hero moments genuinely unmatchable, and they are optional in the sense that
the site is finished and good without them.
