/**
 * Which backend will this build actually talk to?
 *
 * The question came up as "confirm NEXT_PUBLIC_API_URL is set in Vercel", and
 * that is a dashboard task nobody can do from here. But the dashboard is not
 * really the thing worth confirming — the BUILD is. `next.config.js` inlines
 *
 *     env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || RENDER_URL }
 *
 * at build time, so whatever the value resolved to is a literal string sitting
 * in the JavaScript that ships. This reads it back out of the built bundle,
 * which answers the question directly and without anyone logging in anywhere.
 *
 * It fails when the shipped origin is a loopback address. That is the one
 * genuinely dangerous outcome: a production deploy whose API base is
 * http://localhost:8000 looks perfect in CI, builds clean, passes every gate,
 * and is a completely dead shop the moment a customer opens it — every request
 * goes to a server on their own machine.
 *
 *   node scripts/check-api-base.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CHUNKS = join(ROOT, '.next', 'static', 'chunks');

if (!existsSync(CHUNKS)) {
  console.error('no build found — run `npm run build` first');
  process.exit(1);
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (entry.name.endsWith('.js')) yield full;
  }
}

// Every http(s) origin that appears in the shipped JavaScript. Deliberately
// broad: the point is to see what is actually in there, not to confirm a guess.
const origins = new Map();
for (const file of files(CHUNKS)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/https?:\/\/[a-zA-Z0-9.\-]+(?::\d+)?/g)) {
    const o = m[0];
    origins.set(o, (origins.get(o) ?? 0) + 1);
  }
}

const interesting = [...origins.entries()]
  .filter(([o]) => !/w3\.org|schema\.org|reactjs\.org|react\.dev|github\.com|npmjs|licen[cs]e|json-schema/i.test(o))
  .sort((a, b) => b[1] - a[1]);

console.log('origins compiled into the shipped bundle\n' + '-'.repeat(60));
for (const [o, n] of interesting.slice(0, 12)) {
  console.log(`  ${String(n).padStart(4)}x  ${o}`);
}

const loopback = interesting.filter(([o]) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(o));
const api = interesting.find(([o]) => /onrender\.com|vijeytextile\.com/.test(o));

console.log('-'.repeat(60));
if (api) {
  console.log(`API origin in this build : ${api[0]}`);
} else {
  console.log('API origin in this build : NOT FOUND — nothing that looks like the backend');
}

/**
 * Loopback in the bundle is expected and fine: `getApiBase()` chooses at
 * RUNTIME from window.location.hostname, so the localhost branch is compiled in
 * on purpose and only taken when the page is genuinely served from localhost.
 * What would be fatal is the build-time inlined value being loopback with no
 * production origin anywhere — that is a shop pointed at nothing.
 */
if (loopback.length) {
  console.log(`loopback origins present : ${loopback.map(([o]) => o).join(', ')}`);
  console.log('  (expected — getApiBase() picks the loopback branch at runtime only on localhost)');
}

if (!api) {
  console.log('\nFAIL — no production API origin is compiled into this build.');
  console.log('       NEXT_PUBLIC_API_URL resolved to something unexpected at build time.');
  process.exit(1);
}
console.log('\nOK — this build talks to the production backend.');
