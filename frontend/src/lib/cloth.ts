/**
 * The cloth each category is cut from, and the stand-in for a piece not yet
 * photographed.
 *
 * WHAT THIS REPLACES. An emoji. A product with no image rendered 👶 👘 👗 👒 💃
 * ✨ at six times the body size, picked by category, above the category name in
 * maroon. On a shop whose entire promise is that the colour you see is the
 * colour that arrives, the fallback for a missing photograph was a cartoon —
 * and a cartoon that says "baby" tells a customer nothing about the garment.
 *
 * THE SISTER SHOP SOLVED THIS AND THE ANSWER DOES NOT TRANSFER. There, an
 * unphotographed piece becomes its natural DYE — flat, matte, woven, six earth
 * pigments a workroom actually keeps. That is right for a daylit workroom of
 * cottons. It is wrong here. This is a dark room at night and the stock is
 * silk: pattu, organza, tissue. Silk's whole behaviour is that it CATCHES
 * LIGHT — a bolt of it in a dim shop is not a flat colour, it is a deep colour
 * with a band of light lying across the fold.
 *
 * So the same idea takes the opposite form. Deep, saturated grounds rather
 * than earth pigments, and a diagonal sheen across each one rather than a
 * plain weave. Set beside its sister these read as two different materials,
 * which is exactly what they are.
 *
 * RELIT WITH THE SHOP. These were near-black when the shop was a dark room —
 * correct there, and holes punched in a page once the shop went light. They
 * are mid-tones now: saturated enough that light ink still reads on them, pale
 * enough to sit on a near-white counter as cloth rather than as absence. The
 * sheen survives, because that is what makes silk read as silk.
 *
 * It stays honest: nobody mistakes it for a photograph, a Lehenga does not
 * look like a Baby Frock, and it costs two CSS gradients and no request.
 */

export interface Cloth {
  /** What a shopkeeper would call the colour. */
  name: string;
  /** The two stops the bolt is built from. */
  from: string;
  to: string;
  /** Type colour that stays legible on that ground. */
  ink: string;
}

const ROSE: Cloth     = { name: 'Rose pattu',    from: '#C06B87', to: '#A2536D', ink: '#241A1F' };
const PEACOCK: Cloth  = { name: 'Peacock',       from: '#2F7F86', to: '#22646A', ink: '#FFFFFF' };
const TURMERIC: Cloth = { name: 'Turmeric silk', from: '#C08A1E', to: '#9C6E12', ink: '#241A1F' };
const SLATE: Cloth    = { name: 'Slate tissue',  from: '#5C6E82', to: '#48586A', ink: '#FFFFFF' };
const WINE: Cloth     = { name: 'Wine',          from: '#A83455', to: '#87243F', ink: '#FFFFFF' };
const EMERALD: Cloth  = { name: 'Emerald',       from: '#3A7F60', to: '#2A644A', ink: '#FFFFFF' };

/**
 * Category to cloth. Keyed loosely on purpose: the admin form lets a
 * shopkeeper type a category, so this has to survive "Party Wear",
 * "party wear" and "Party-Wear" without a migration.
 */
const BY_CATEGORY: Record<string, Cloth> = {
  'baby frocks': ROSE,
  'baby frock': ROSE,
  chudithar: PEACOCK,
  frocks: TURMERIC,
  frock: TURMERIC,
  'western dresses': SLATE,
  'western dress': SLATE,
  lehenga: WINE,
  'party wear': EMERALD,
  'party wears': EMERALD,
};

/**
 * The cloth for a category. Anything unrecognised gets slate — the most
 * neutral of the six, so a category nobody planned for still looks deliberate
 * rather than defaulting to the loudest bolt in the room.
 */
export function clothFor(category?: string | null): Cloth {
  if (!category) return SLATE;
  return BY_CATEGORY[category.trim().toLowerCase().replace(/[-_]+/g, ' ')] ?? SLATE;
}

/**
 * A deterministic per-piece shift, so two pieces in one category are not the
 * same rectangle.
 *
 * Silk is dyed in lots exactly as cotton is, and two bolts from different lots
 * never match. The piece's own id picks its lot. Deterministic matters: the
 * same piece must look the same on every visit and on the server as in the
 * browser, so this is arithmetic on the id and never Math.random().
 */
function shift(hex: string, seed: number): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);

  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const t = Math.abs(Math.imul(seed || 1, 2654435761) % 1000) / 1000 - 0.5;
  const H = (h + t * 6 + 360) % 360;
  const L = Math.min(0.9, Math.max(0.05, l + t * 0.06));

  const c = (1 - Math.abs(2 * L - 1)) * s;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  const seg = Math.floor(H / 60) % 6;
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg]
    .map((v) => Math.round((v + m) * 255));

  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The bolt, as a background.
 *
 * Three layers: the deep ground, a diagonal band of light lying across it —
 * that is the whole point, it is what makes silk read as silk rather than as a
 * coloured rectangle — and a very fine warp so the surface has a texture at
 * close range. `backgroundImage` rather than an SVG so it scales to any plate
 * size, prints, and costs no request.
 *
 * The computed colours are baked into the gradient rather than applied as a
 * CSS `filter`, because a filter applies to an element AND its children and
 * would drag the type written on the cloth along with it.
 */
export function boltGround(cloth: Cloth, seed?: number): React.CSSProperties {
  const from = seed ? shift(cloth.from, seed) : cloth.from;
  const to = seed ? shift(cloth.to, seed) : cloth.to;
  return {
    backgroundColor: from,
    backgroundImage: [
      // The light on the fold.
      `linear-gradient(112deg, rgba(255,255,255,0) 28%, rgba(255,248,235,0.16) 45%, rgba(255,248,235,0.05) 56%, rgba(255,255,255,0) 72%)`,
      // The warp, barely there.
      `repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 4px)`,
      `linear-gradient(158deg, ${from} 0%, ${to} 100%)`,
    ].join(','),
  };
}
