#!/usr/bin/env node
/**
 * Fails the build when a delivery tier's hero assets are missing.
 *
 * This shipped a broken hero once and the failure had two independent causes,
 * both silent:
 *
 *   1. `public/hero/` was never staged into git. Every commit added
 *      `frontend/src` and `frontend/scripts` explicitly, so the encoded assets
 *      existed only on one machine. Any deployed build served 404 for every
 *      poster.
 *   2. The assets were written 45 minutes AFTER `next build` ran. Next
 *      snapshots `public/` at build time, so even locally `next start` served
 *      404 for files sitting on disk.
 *
 * Neither produced a warning. The first symptom was a broken-image glyph and
 * its alt text rendering as loose text above the navigation, on the single
 * most important asset on the site.
 *
 * A generated asset that the UI hard-depends on has to be verified at build
 * time, exactly like the Tailwind duplicate-key guard. Run from `npm run build`
 * BEFORE next build, so a missing poster stops the build rather than reaching a
 * customer.
 */
const fs = require('node:fs');
const path = require('node:path');

const HERO = path.join(__dirname, '..', 'public', 'hero');
const { TIER_PROFILES_JSON } = require('./tier-profiles.cjs');

/** Rungs the UI can actually resolve to and therefore must be able to serve. */
const REQUIRED = TIER_PROFILES_JSON.map((p) => p.tier);

const problems = [];
const summary = [];

if (!fs.existsSync(HERO)) {
  console.error(`\n  public/hero does not exist.\n`);
  console.error('  Generate the ladder before building:');
  console.error('    node scripts/render-sequence.mjs --url http://localhost:3100');
  console.error('    node scripts/encode-sequence.mjs\n');
  process.exit(1);
}

for (const profile of TIER_PROFILES_JSON) {
  const { tier, frames } = profile;
  const dir = path.join(HERO, tier);

  if (!fs.existsSync(dir)) {
    problems.push(`${tier}: directory missing`);
    continue;
  }

  // The poster is the one asset with no fallback behind it — it is what paints
  // in the first 200ms and what the hero degrades to. Both encodings must
  // exist: AVIF for the <source>, WebP for the <img> that catches browsers
  // without AVIF decode.
  for (const ext of ['avif', 'webp']) {
    const poster = path.join(dir, `poster.${ext}`);
    if (!fs.existsSync(poster)) {
      problems.push(`${tier}: poster.${ext} missing — the hero has nothing to paint`);
    } else if (fs.statSync(poster).size < 1024) {
      problems.push(`${tier}: poster.${ext} is ${fs.statSync(poster).size} bytes — truncated`);
    }
  }

  // Frame count. A short sequence is survivable (the scrubber falls back to the
  // nearest loaded frame), so this warns through the summary rather than
  // failing — but a tier with NO frames beyond the poster is a broken rung.
  const found = fs.readdirSync(dir).filter((f) => /^\d{4}\.avif$/.test(f)).length;
  if (frames > 1 && found === 0) {
    problems.push(`${tier}: no numbered frames — declared ${frames}`);
  }

  const bytes = fs.readdirSync(dir)
    .reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
  summary.push({ tier, found, declared: frames, bytes });
}

if (problems.length) {
  console.error('\n  Hero assets are incomplete.\n');
  for (const p of problems) console.error(`    ${p}`);
  console.error('\n  Regenerate:');
  console.error('    node scripts/render-sequence.mjs --url http://localhost:3100');
  console.error('    node scripts/encode-sequence.mjs');
  console.error('\n  And confirm public/hero is committed — it is easy to build');
  console.error('  locally with assets that were never staged into git.\n');
  process.exit(1);
}

const human = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);
console.log('  hero assets present:');
for (const s of summary) {
  console.log(`    ${s.tier.padEnd(10)} ${String(s.found).padStart(3)}/${String(s.declared).padEnd(4)} frames  ${human(s.bytes)}`);
}
