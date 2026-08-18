/**
 * Resumes an interrupted encode.
 *
 * encode-sequence.mjs deletes and rebuilds every tier, which is correct for a
 * clean run and wasteful when one rung was interrupted — re-encoding four
 * finished tiers to finish a fifth costs half an hour for nothing.
 *
 * This fills in only what is missing, per tier, and is safe to run repeatedly.
 *
 *   node scripts/resume-encode.mjs [tier]
 */
import { readdirSync, mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { TIER_PROFILES_JSON } from './tier-profiles.mjs';

const RAW = resolve('public/hero/raw');
const OUT = resolve('public/hero');
const ONLY = process.argv[2] || null;

const human = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(0)} KB`);

const source = readdirSync(RAW).filter((f) => f.endsWith('.png')).sort();
if (!source.length) { console.error('no source frames'); process.exit(1); }

/** Same even sampling as the full encoder, so a resumed tier matches exactly. */
function sample(files, count) {
  if (count >= files.length) return files;
  if (count === 1) return [files[0]];
  const out = [];
  for (let i = 0; i < count; i++) out.push(files[Math.round((i / (count - 1)) * (files.length - 1))]);
  return [...new Set(out)];
}

for (const profile of TIER_PROFILES_JSON) {
  const { tier, frames, width, quality } = profile;
  if (ONLY && tier !== ONLY) continue;

  const dir = join(OUT, tier);
  mkdirSync(dir, { recursive: true });
  const chosen = sample(source, frames);

  let written = 0;
  for (let i = 0; i < chosen.length; i++) {
    const stem = join(dir, String(i).padStart(4, '0'));
    // Skip anything already encoded AND non-truncated. A file cut off mid-write
    // by a killed process is the exact case a naive existsSync check misses.
    const done = ['avif', 'webp'].every(
      (e) => existsSync(`${stem}.${e}`) && statSync(`${stem}.${e}`).size > 512,
    );
    if (done) continue;

    const src = join(RAW, chosen[i]);
    await sharp(src).resize({ width, withoutEnlargement: true })
      .avif({ quality, effort: 6, chromaSubsampling: '4:2:0' }).toFile(`${stem}.avif`);
    await sharp(src).resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 }).toFile(`${stem}.webp`);
    written++;
    if (written % 10 === 0) process.stdout.write(`\r  ${tier}: +${written}   `);
  }

  // The poster last — it is what the asset guard checks, so its presence is the
  // signal that this tier is genuinely complete.
  const poster = join(dir, 'poster');
  for (const ext of ['avif', 'webp']) {
    if (existsSync(`${poster}.${ext}`) && statSync(`${poster}.${ext}`).size > 1024) continue;
    const enc = ext === 'avif'
      ? sharp(join(RAW, source[0])).resize({ width, withoutEnlargement: true }).avif({ quality: Math.min(90, quality + 12), effort: 6 })
      : sharp(join(RAW, source[0])).resize({ width, withoutEnlargement: true }).webp({ quality: Math.min(90, quality + 12), effort: 6 });
    await enc.toFile(`${poster}.${ext}`);
  }

  let avif = 0, webp = 0;
  for (const f of readdirSync(dir)) {
    if (/^\d{4}\.avif$/.test(f)) avif += statSync(join(dir, f)).size;
    if (/^\d{4}\.webp$/.test(f)) webp += statSync(join(dir, f)).size;
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    tier, frames: chosen.length, width, quality,
    bytes: { avif, webp, posterAvif: statSync(`${poster}.avif`).size },
  }, null, 2));

  console.log(`\r  ${tier.padEnd(10)} ${String(chosen.length).padStart(3)} frames  AVIF ${human(avif).padEnd(10)} WebP ${human(webp).padEnd(10)} poster ${human(statSync(`${poster}.avif`).size)}`);
}
