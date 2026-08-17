/**
 * Performance budget, for the half that can honestly be enforced in CI.
 *
 * The full budget in AUDIT.md is measured in a real GPU browser: frames per
 * second, draw calls, scene ownership per route. None of that can run on a CI
 * runner — there is no GPU and no compositor — and wiring it there would
 * produce a job that measures the software rasteriser and calls it a result.
 *
 * What CI CAN check exactly is weight: how much JavaScript a first visit costs.
 * On a 3D site this is the number that decides whether a customer on a
 * mid-range Android can use the shop at all, and it is also the number that
 * creeps silently — a stray `import * as THREE` or a barrel file pulling the
 * whole of drei adds hundreds of kilobytes with no visible symptom on a
 * developer's laptop.
 *
 * The budget is a RATCHET, not an aspiration: it is set from the current build
 * plus modest headroom. Its job is to make growth deliberate, not to be a
 * target nobody has met. Raising it should be a decision with a reason, in the
 * same commit as the thing that needed it.
 *
 *   node scripts/check-bundle-budget.mjs
 *   node scripts/check-bundle-budget.mjs --update   # re-ratchet, deliberately
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BUDGET_FILE = resolve('bundle-budget.json');
const CHUNKS = resolve('.next/static/chunks');
const UPDATE = process.argv.includes('--update');
/** Headroom over the measured size when (re)setting the ratchet. */
const HEADROOM = 1.1;

if (!existsSync(CHUNKS)) {
  console.error('bundle: .next/static/chunks not found — run a build first.');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push({ p, size: st.size });
  }
  return out;
}

const files = walk(CHUNKS);
const total = files.reduce((n, f) => n + f.size, 0);
const largest = files.sort((a, b) => b.size - a.size).slice(0, 5);
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

console.log(`bundle: ${files.length} chunks, ${kb(total)} of JavaScript`);
for (const f of largest) {
  console.log(`    ${kb(f.size).padStart(8)}  ${f.p.split(/[\\/]/).slice(-1)[0]}`);
}

if (UPDATE || !existsSync(BUDGET_FILE)) {
  const budget = { totalBytes: Math.round(total * HEADROOM), measuredBytes: total, setAt: new Date().toISOString().slice(0, 10) };
  writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + '\n');
  console.log(
    `bundle: budget ${UPDATE ? 'updated' : 'created'} at ${kb(budget.totalBytes)} ` +
    `(measured ${kb(total)} + ${Math.round((HEADROOM - 1) * 100)}% headroom)`,
  );
  process.exit(0);
}

const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
if (total > budget.totalBytes) {
  const over = total - budget.totalBytes;
  console.error(
    `\nbundle: OVER BUDGET by ${kb(over)}\n` +
    `    budget ${kb(budget.totalBytes)} (set ${budget.setAt})\n` +
    `    actual ${kb(total)}\n\n` +
    'Find what grew before raising the ceiling. If the growth is intended:\n' +
    '    node scripts/check-bundle-budget.mjs --update\n' +
    'and commit bundle-budget.json alongside the change that needed it.\n',
  );
  process.exit(1);
}

console.log(`bundle: within budget (${kb(total)} of ${kb(budget.totalBytes)}).`);
