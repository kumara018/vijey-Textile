/**
 * Encodes the rendered PNGs into the delivered tier ladder and reports what
 * each rung actually costs.
 *
 * Every number printed here is measured from the bytes on disk. Nothing is
 * estimated — the whole point of building the ladder is to know, per rung, what
 * a customer downloads and how long it takes on the connection they have.
 *
 * AVIF first, WebP as the compatibility sibling. AVIF is typically 30-50%
 * smaller than WebP at matched quality on photographic content, which is
 * exactly what these frames are; WebP exists because AVIF decode is still slow
 * on some older Android hardware, and a fast download that then blocks the main
 * thread decoding is not a win.
 *
 *   node scripts/encode-sequence.mjs
 */
import { readdirSync, mkdirSync, statSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { TIER_PROFILES_JSON } from './tier-profiles.mjs';

const RAW = resolve('public/hero/raw');
const OUT = resolve('public/hero');

/** Throughput assumptions for the load-time table, in Mbit/s. */
const LINKS = [
  { name: 'slow 3g',  mbps: 0.4 },
  { name: 'regular 3g', mbps: 1.6 },
  { name: 'regular 4g', mbps: 9.0 },
  { name: 'fast 4g / 5g', mbps: 30.0 },
];

const human = (b) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(2)} MB` : `${(b / 1024).toFixed(0)} KB`;

if (!existsSync(RAW)) {
  console.error(`\n  No rendered frames at ${RAW}`);
  console.error('  Run: node scripts/render-sequence.mjs --url http://localhost:3100\n');
  process.exit(1);
}

const source = readdirSync(RAW).filter((f) => f.endsWith('.png')).sort();
if (source.length === 0) {
  console.error(`\n  ${RAW} contains no PNGs.\n`);
  process.exit(1);
}

console.log(`\n  source: ${source.length} frames\n`);

/**
 * Pick `count` frames evenly across the source.
 *
 * The camera move is continuous, so a lower rung is the same move sampled less
 * often — never a shorter or different move. Always includes the first and last
 * frame so the sequence starts and ends exactly where the richer rungs do.
 */
function sample(files, count) {
  if (count >= files.length) return files;
  if (count === 1) return [files[0]];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(files[Math.round((i / (count - 1)) * (files.length - 1))]);
  }
  return [...new Set(out)];
}

const report = [];

for (const profile of TIER_PROFILES_JSON) {
  const { tier, frames, width, quality } = profile;
  const dir = join(OUT, tier);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const chosen = sample(source, frames);
  let avif = 0;
  let webp = 0;

  for (let i = 0; i < chosen.length; i++) {
    const src = join(RAW, chosen[i]);
    const stem = join(dir, String(i).padStart(4, '0'));

    // effort 6 is slow to encode and meaningfully smaller. This runs once,
    // offline, so encode time is free and every byte saved is paid back on
    // every visit.
    await sharp(src).resize({ width, withoutEnlargement: true })
      .avif({ quality, effort: 6, chromaSubsampling: '4:2:0' })
      .toFile(`${stem}.avif`);
    await sharp(src).resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toFile(`${stem}.webp`);

    avif += statSync(`${stem}.avif`).size;
    webp += statSync(`${stem}.webp`).size;
  }

  /**
   * The static first frame, encoded separately at higher quality.
   *
   * This is the frame that paints instantly on every hero and is the whole
   * safety net for shipping a heavy maximum tier: if the sequence never
   * arrives — slow link, decode failure, JS disabled — this one image IS the
   * hero and has to look finished on its own. It is never worth saving bytes
   * on.
   */
  const poster = join(dir, 'poster');
  await sharp(join(RAW, source[0])).resize({ width, withoutEnlargement: true })
    .avif({ quality: Math.min(90, quality + 12), effort: 6 }).toFile(`${poster}.avif`);
  await sharp(join(RAW, source[0])).resize({ width, withoutEnlargement: true })
    .webp({ quality: Math.min(90, quality + 12), effort: 6 }).toFile(`${poster}.webp`);

  const posterAvif = statSync(`${poster}.avif`).size;

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    tier, frames: chosen.length, width, quality,
    bytes: { avif, webp, posterAvif },
  }, null, 2));

  report.push({ tier, frames: chosen.length, width, avif, webp, posterAvif });
}

/* ── The ladder ──────────────────────────────────────────────────────── */

console.log('  TIER        FRAMES  WIDTH   AVIF total   WebP total   poster (first paint)');
console.log('  ' + '-'.repeat(74));
for (const r of report) {
  console.log(
    '  ' + r.tier.padEnd(11) +
    String(r.frames).padEnd(8) +
    String(r.width).padEnd(8) +
    human(r.avif).padEnd(13) +
    human(r.webp).padEnd(13) +
    human(r.posterAvif),
  );
}

console.log('\n  Time to first paint — the poster, which is all a visitor waits for:\n');
console.log('  TIER        ' + LINKS.map((l) => l.name.padEnd(15)).join(''));
console.log('  ' + '-'.repeat(74));
for (const r of report) {
  const row = LINKS.map((l) => `${((r.posterAvif * 8) / (l.mbps * 1e6)).toFixed(2)}s`.padEnd(15));
  console.log('  ' + r.tier.padEnd(12) + row.join(''));
}

console.log('\n  Full sequence, AVIF, streamed after the poster:\n');
console.log('  TIER        ' + LINKS.map((l) => l.name.padEnd(15)).join(''));
console.log('  ' + '-'.repeat(74));
for (const r of report) {
  const row = LINKS.map((l) => `${((r.avif * 8) / (l.mbps * 1e6)).toFixed(1)}s`.padEnd(15));
  console.log('  ' + r.tier.padEnd(12) + row.join(''));
}
console.log('');
