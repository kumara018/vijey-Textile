/**
 * Visual regression: shipped imagery must match a baseline someone reviewed.
 *
 * WHAT THIS CATCHES.
 *
 * The other three gates answer different questions:
 *   check:tailwind  — is the config coherent?
 *   check:hero      — are the hero assets present?
 *   check:frames    — does a frame contain a lit scene rather than flat ground?
 *
 * None of them notices a frame being REPLACED by a different but equally valid
 * frame: a half-finished re-render committed by mistake, a tier encoded from
 * the wrong source, an image tool re-compressing or re-ordering the ladder.
 * Every one of those passes "present" and "not dead" and ships a hero nobody
 * looked at. This makes the build fail until someone looks and re-baselines.
 *
 * WHY A HASH AND NOT A PERCEPTUAL SIGNATURE.
 *
 * The first version of this file compared an 8×8 grid of mean luminance with a
 * tolerance, so a re-encode at identical settings would not trip it. It failed
 * its own smoke test: frame 0005 was replaced wholesale with frame 0040 and the
 * gate reported "48 images match baseline".
 *
 * Calibrating it did not help, and measuring showed why. Across grids from 8×8
 * to 32×32 and 32–64 levels, the minimum drift between ADJACENT frames of the
 * sequence was 0.000 — some consecutive frames are identical at that
 * resolution, because a slow camera move over a mostly-dark frame barely moves
 * coarse luminance. The noise floor and the signal overlap completely. No
 * threshold exists that passes a re-encode and fails a swap, so any tolerance
 * large enough to be safe was large enough to be blind.
 *
 * The tolerance was solving a problem that does not exist: this encode is
 * deterministic — same source, same settings, same bytes. So the comparison is
 * exact. A hash has nothing to calibrate, cannot be fooled by a change it
 * happens not to notice, and needs no image decoding at all (which also means
 * this gate has no `sharp` dependency to install on the build machine).
 *
 * If a re-encode ever does produce different bytes, this fails loudly and you
 * re-baseline deliberately — which is the workflow after a re-render anyway.
 *
 * Usage:
 *   node scripts/visual-regression.mjs                    # check hero ladder
 *   node scripts/visual-regression.mjs --update           # accept as baseline
 *   node scripts/visual-regression.mjs --shots /tmp/shots # check route captures
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i > -1 && args[i + 1] ? args[i + 1] : d;
};

const SHOTS = val('--shots', null);
const ROOT = resolve(SHOTS ?? val('--dir', 'public/hero'));
const BASELINE = resolve(SHOTS ? 'visual-baseline.shots.json' : 'visual-baseline.json');
const UPDATE = has('--update');

/** Every image under root, excluding the uncompressed source frames. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'raw') continue; // 4K PNG source, not shipped
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(avif|webp|png|jpe?g)$/i.test(name)) out.push(p);
  }
  return out;
}

/** Content hash plus byte length — exact, and cheap enough for 545 files. */
function fingerprint(file) {
  const buf = readFileSync(file);
  return `${createHash('sha256').update(buf).digest('hex').slice(0, 16)}:${buf.length}`;
}

if (!existsSync(ROOT)) {
  // Missing route captures are a "you did not run the shoot" state, not a
  // failure; a missing hero directory is check:hero's job to report.
  console.log(`visual: ${relative(process.cwd(), ROOT)} not present — skipping.`);
  process.exit(0);
}

const files = walk(ROOT).sort();
if (files.length === 0) {
  console.log('visual: nothing to compare.');
  process.exit(0);
}

const current = {};
for (const f of files) {
  current[relative(ROOT, f).replace(/\\/g, '/')] = fingerprint(f);
}

if (UPDATE || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 0) + '\n');
  console.log(
    `visual: baseline ${UPDATE ? 'updated' : 'created'} — ${files.length} images -> ${relative(process.cwd(), BASELINE)}`,
  );
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const changed = [];
const added = [];
const removed = [];

for (const [k, fp] of Object.entries(current)) {
  if (!base[k]) { added.push(k); continue; }
  if (fp !== base[k]) changed.push(k);
}
for (const k of Object.keys(base)) if (!current[k]) removed.push(k);

// An ADDED image is not a regression — a new tier or a new capture is normal
// growth. Reported, not failed.
if (added.length) {
  console.log(`visual: ${added.length} new image(s), not in baseline (not a failure):`);
  for (const k of added.slice(0, 6)) console.log(`    + ${k}`);
}

if (!changed.length && !removed.length) {
  console.log(`visual: ${files.length} images match baseline.`);
  process.exit(0);
}

console.error('\nvisual: FAILED — shipped imagery differs from the reviewed baseline.');
for (const k of removed.slice(0, 10)) console.error(`    - missing: ${k}`);
for (const k of changed.slice(0, 10)) console.error(`    ~ changed: ${k}`);
const extra = (changed.length + removed.length) - 10;
if (extra > 0) console.error(`    …and ${extra} more`);
console.error(
  '\nIf the change is intended, LOOK at the images, then run:\n' +
    '    node scripts/visual-regression.mjs --update\n' +
    'and commit the baseline in the same commit as the images.\n',
);
process.exit(1);
