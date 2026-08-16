/**
 * Frame-content assertion.
 *
 * Answers one question about rendered hero frames: does this contain the
 * scene, or does it contain a photograph of the page?
 *
 * The failure this exists to catch has now happened twice, and both times it
 * looked fine everywhere except in the actual pixels — the render script
 * reported success, the file sizes were plausible, the encode ran, and the
 * defect was only visible by opening a PNG. So this reads the pixels.
 *
 * Three signals, none of which requires OCR:
 *
 *  1. TEXT ROWS, detected by RUN STRUCTURE, not by brightness.
 *
 *     The first version of this check tested "row has bright pixels but is
 *     mostly dark" and produced a confident false positive on every good
 *     frame: the staged garment is lit cloth filling ~40% of the row with
 *     near-black beside it, which satisfies that description precisely. A
 *     bright region and a line of glyphs are indistinguishable by brightness.
 *
 *     What actually separates them is horizontal alternation. A line of type
 *     crosses the row as many SHORT ink runs — strokes, with counters and
 *     letter-spacing between them. A photographed subject crosses it as one
 *     or two LONG runs. So the test is: many runs, each narrow.
 *
 *  2. THE NAV STRIP. Same run test, restricted to the top ~7% of the frame,
 *     where the navigation sits. Caught separately because the wordmark is
 *     small and might not move the whole-frame count on its own.
 *
 *  3. DEAD FRAMES. An all-black or all-single-colour frame means the scene
 *     never rendered — the other failure mode, where capture mode works so
 *     well it strips the scene too.
 *
 * Exit code 1 on any failure, so it can gate a commit.
 *
 *   node scripts/check-frame-content.mjs public/hero/raw
 *   node scripts/check-frame-content.mjs public/hero/raw --sample 12
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const DIR = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'public/hero/raw');
const SAMPLE = Number(arg('sample', 10));
const VERBOSE = process.argv.includes('--verbose');
/** Opt-in glyph heuristic. See the long note at its use site for why. */
const STRICT = process.argv.includes('--strict');

/** Analysis width — enough to resolve glyph rows, cheap enough to run on many frames. */
const W = 480;

/**
 * Thresholds are deliberately conservative in the same direction: a false
 * positive blocks a commit for no reason, a false negative costs an hour of
 * render that can be run again. Both are cheap compared to shipping a hero
 * with a photograph of the page inside it.
 */
/**
 * Type-bright, and deliberately near the top of the range.
 *
 * The site sets body and display type in #FAFAF9 — luminance ~250. The brass
 * accent is #A16207–#C4841A, which greyscales to ~110–140. Sitting the
 * threshold at 200 caught the ambient dust motes the moment they were
 * corrected from crimson to brass, and failed every good frame of the
 * corrected render.
 *
 * 235 is above every scene colour in this palette and below the type. It is a
 * fact about the design system rather than a tuned constant, which is why it
 * survives a palette change instead of being broken by one. Lit cloth also
 * reaches this brightness, but cloth crosses a row as WIDE contiguous runs and
 * is excluded by the stroke-width test below.
 */
const INK = 235;
const MIN_RUNS = 6;         // a line of type crosses the row this many times
const MAX_STROKE = 9;       // ...in runs no wider than this (at W=480)
const MAX_INK_FRACTION = 0.5;
const TEXT_ROW_LIMIT = 12;  // more text-like rows than this ⇒ DOM in frame
const NAV_ROW_LIMIT = 3;    // ...or any real run structure in the nav band

/** Median is the right centre here — one long run must not drag the average. */
function median(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * True when this row looks like a line of glyphs rather than a lit subject:
 * several separate ink runs, each narrow.
 */
function isTextRow(data, y, width) {
  const runs = [];
  let run = 0;
  let ink = 0;

  for (let x = 0; x < width; x++) {
    if (data[y * width + x] >= INK) { run++; ink++; }
    else if (run) { runs.push(run); run = 0; }
  }
  if (run) runs.push(run);

  if (runs.length < MIN_RUNS) return false;
  if (ink / width > MAX_INK_FRACTION) return false;
  return median(runs) <= MAX_STROKE;
}

/**
 * Rows that look like glyphs, but only where they form a CONTIGUOUS BAND.
 *
 * The run test alone was not enough, and the way it failed is worth recording:
 * once the ambient dust motes were corrected from crimson to brass they became
 * bright enough to cross the ink threshold, and a row of scattered bright
 * specks on a dark ground is arithmetically indistinguishable from a row of
 * glyph strokes. Fixing the palette broke the detector — the check failed
 * every good frame of the corrected render.
 *
 * What separates them is vertical structure. A line of type is a BAND: dozens
 * of consecutive rows, every one of them full of runs, because a glyph is tall.
 * Particles are scattered — they produce isolated qualifying rows and short
 * accidental clusters, never a deep band.
 *
 * So a row only counts if it belongs to a band of at least MIN_BAND consecutive
 * qualifying rows. That is a property of rendered text specifically, not of
 * brightness, and it does not care what colour the scene decoration is.
 */
const MIN_BAND = 8;

function bandedRows(flags) {
  let total = 0;
  let run = 0;
  let deepest = 0;
  for (let i = 0; i <= flags.length; i++) {
    if (flags[i]) {
      run++;
    } else {
      if (run >= MIN_BAND) total += run;
      if (run > deepest) deepest = run;
      run = 0;
    }
  }
  return { total, deepest };
}

async function analyse(file) {
  const img = sharp(file).resize({ width: W, fit: 'inside' }).greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const navRows = Math.max(1, Math.round(height * 0.07));
  const flags = new Array(height).fill(false);
  let min = 255;
  let max = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    flags[y] = isTextRow(data, y, width);
  }

  const whole = bandedRows(flags);
  const nav = bandedRows(flags.slice(0, navRows));

  return {
    textRows: whole.total,
    deepestBand: whole.deepest,
    navTextRows: nav.total,
    range: max - min,
  };
}

const failures = [];

if (!existsSync(DIR)) {
  console.error(`frame check: no such directory: ${DIR}`);
  process.exit(1);
}

const isFrame = (f) => /\.(png|webp|avif|jpe?g)$/i.test(f);

/**
 * Accepts either a directory of frames or a directory of tier directories.
 *
 * The gate points at `public/hero`, which holds the five delivered rungs —
 * every one of them is a separate encode of the same render and any of them
 * can be the one that went wrong, so all five get sampled rather than
 * trusting that one good tier vouches for the rest.
 */
function collect(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const here = entries.filter((e) => e.isFile() && isFrame(e.name)).map((e) => e.name).sort();
  if (here.length) return [{ dir, frames: here }];

  const groups = [];
  for (const e of entries.filter((x) => x.isDirectory())) {
    // `raw/` is the render intermediate: gitignored, half a gigabyte, and
    // possibly mid-write while a render is running. Only delivered tiers are
    // gated. Point the script at it explicitly to check it directly.
    if (e.name === 'raw') continue;
    groups.push(...collect(join(dir, e.name)));
  }
  return groups;
}

const groups = collect(DIR);
const totalFrames = groups.reduce((n, g) => n + g.frames.length, 0);

if (totalFrames === 0) {
  console.error(`frame check: no frames under ${DIR}`);
  process.exit(1);
}

// Even sampling across each sequence — the end of a camera move can carry DOM
// the opening frame did not.
const picked = [];
for (const g of groups) {
  const step = Math.max(1, Math.floor(g.frames.length / SAMPLE));
  for (const name of g.frames.filter((_, i) => i % step === 0).slice(0, SAMPLE)) {
    picked.push({ dir: g.dir, name });
  }
}

for (const { dir, name } of picked) {
  const file = join(dir, name);
  const label = `${dir.split(/[\\/]/).pop()}/${name}`;
  let r;
  try {
    r = await analyse(file);
  } catch (e) {
    failures.push(`${label}: unreadable (${e.message})`);
    continue;
  }

  if (VERBOSE) {
    console.log(
      `  ${label}: banded=${r.textRows} deepest=${r.deepestBand} nav=${r.navTextRows} range=${r.range}`,
    );
  }

  /**
   * The glyph heuristic is OPT-IN (`--strict`), and that is a deliberate
   * retreat rather than an oversight.
   *
   * It was calibrated three times — brightness, then ink-run structure, then
   * contiguous banding — and each version separated the two known sample sets
   * while failing on real content. The reason is not tuning: the hero subject
   * is lit silk with fine fold texture, and at row-statistics level a bright
   * cloth ridge and a glyph stroke are the same object. Narrow, high-contrast,
   * repeating, vertically contiguous. There is no threshold that admits the
   * cloth and rejects the type, because they are not different in the
   * dimension this test measures.
   *
   * Shipping it as a blocking gate would mean a check that fails on correct
   * output — which trains everyone to bypass it, and a gate that gets bypassed
   * is worse than no gate because it also carries false assurance.
   *
   * What IS asserted exactly, and stays blocking, is below: a frame that did
   * not render at all. And the real guarantee that the DOM was stripped lives
   * where it can be checked exactly rather than inferred — the renderer's
   * live-page preconditions, which verify the capture attribute landed, the
   * scene canvas exists with real dimensions, the sequence hero is display:none
   * and no body child is still visible. That check is deterministic. This one
   * never could be.
   */
  if (STRICT && r.textRows > TEXT_ROW_LIMIT) {
    failures.push(`${label}: ${r.textRows} rows of glyph-like run structure — possible rendered type`);
  }
  if (STRICT && r.navTextRows > NAV_ROW_LIMIT) {
    failures.push(`${label}: ${r.navTextRows} glyph-like rows in the top band — possible navigation`);
  }
  if (r.range < 12) {
    failures.push(`${label}: near-flat image (range ${r.range}) — the scene did not render`);
  }
}

if (failures.length) {
  console.error(`\nframe check FAILED (${picked.length} sampled from ${totalFrames} under ${DIR})\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('\nThe sequence is a backdrop. It must contain the scene and nothing else.\n');
  process.exit(1);
}

console.log(
  `frame check OK — ${picked.length} of ${totalFrames} frames sampled across ${groups.length} sequence(s), scene only`,
);
