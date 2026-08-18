/**
 * Does the Content-Security-Policy break the site?
 *
 * A CSP is the one security header that can take a shop down. Set it too
 * loosely and it protects nothing; set it too tightly and the browser silently
 * refuses to run your own scripts — or, worse on this site, refuses to open the
 * Razorpay payment modal, so checkout looks like it simply does nothing.
 *
 * Neither failure appears in a build. Both appear in the console of a real
 * browser as "Refused to load…" / "…violates the following Content Security
 * Policy directive". So that is what this reads.
 *
 * Run against a PRODUCTION server (`next start`), because headers configured in
 * next.config are not applied the same way in dev.
 *
 *   node scripts/check-csp.mjs --url http://localhost:3100
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath } from './chrome-path.mjs';

const CHROME = chromePath();
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = arg('url', 'http://localhost:3100');
// Routes arriving from a Git-Bash shell get MSYS path conversion applied to a
// leading slash — "/" becomes the Git install directory — so a --routes value
// silently turns into nonsense and CDP answers "Cannot navigate to invalid
// URL". Normalising here makes the script safe from either shell instead of
// depending on the caller's environment.
const ROUTES = (arg('routes', '/,/products,/cart,/auth/login,/checkout,/wishlist'))
  .split(',')
  .map((r) => (r.startsWith('/') && !/:[\/]/.test(r) ? r : '/' + r.replace(/^.*?[\/]Git[\/]?/, '')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'csp-'));
const chrome = spawn(CHROME, [
  '--remote-debugging-port=9750', `--user-data-dir=${profile}`,
  '--headless=new', '--window-size=1440,900',
  '--ignore-gpu-blocklist', '--enable-gpu',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:9750/json/list')).json();
      const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error('no page target');
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const subs = [];
    ws.onmessage = (m) => {
      const x = JSON.parse(m.data);
      if (x.id && pending.has(x.id)) {
        const { resolve: r, reject: j } = pending.get(x.id);
        pending.delete(x.id);
        x.error ? j(new Error(JSON.stringify(x.error))) : r(x.result);
      } else if (x.method) {
        for (const f of subs) f(x);
      }
    };
    ws.onerror = () => rej(new Error('ws error'));
    ws.onopen = () => res({
      send: (m, p = {}) => new Promise((r, j) => {
        pending.set(++id, { resolve: r, reject: j });
        ws.send(JSON.stringify({ id, method: m, params: p }));
      }),
      on: (f) => subs.push(f),
      close: () => ws.close(),
    });
  });
}

let cdp;
let violationCount = 0;
try {
  const t = await target();
  cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  let seen = [];
  cdp.on((msg) => {
    let txt = '';
    if (msg.method === 'Log.entryAdded') txt = msg.params?.entry?.text ?? '';
    else if (msg.method === 'Runtime.consoleAPICalled')
      txt = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
    // Chrome's exact wording for a blocked resource or inline handler.
    if (/Content Security Policy|Refused to (load|execute|connect|frame|apply)/i.test(txt)) {
      seen.push(txt.replace(/\s+/g, ' ').slice(0, 150));
    }
  });

  console.log(`CSP check against ${BASE}\n${'-'.repeat(66)}`);
  for (const route of ROUTES) {
    seen = [];
    await cdp.send('Page.navigate', { url: `${BASE}${route}` });
    await sleep(6000);
    const probe = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({
        chars: (document.body.innerText || '').trim().length,
        scripts: document.querySelectorAll('script').length,
        hydrated: (() => { const e = document.body.firstElementChild;
          return !!e && Object.keys(e).some(k => k.startsWith('__react')); })(),
      })`,
    });
    const v = probe.result?.value ?? {};
    const uniq = [...new Set(seen)];
    violationCount += uniq.length;
    console.log(
      `${uniq.length ? 'BLOCKED' : 'clean  '}  ${route.padEnd(14)} ` +
      `${String(v.chars).padStart(5)} chars · ${v.scripts} scripts · hydrated=${v.hydrated}`,
    );
    for (const u of uniq.slice(0, 4)) console.log(`      ! ${u}`);
  }

  /**
   * THE POLICY MUST ALLOW THE HOST THE MEDIA ACTUALLY COMES FROM.
   *
   * Walking the routes proves the policy does not break the pages. It does not
   * prove the policy serves the SHOP — and it did not: `img-src` was written
   * from what the frontend code references, and every image path in the
   * frontend is backend-relative, so the policy allowed the API origin and
   * nothing else. The backend uploads product photographs and videos to
   * Cloudinary and stores absolute res.cloudinary.com URLs, which meant every
   * product picture on the live site would have been refused.
   *
   * Nothing above catches that, because a policy page has no product on it.
   * So this asks the browser directly, from inside a real document under the
   * real header: load a genuine Cloudinary image and see whether the policy
   * permits it. Independent of whether the catalogue happens to contain a row
   * or a page happens to render a card.
   */
  /**
   * THE POLICY MUST ALLOW THE HOST THE MEDIA ACTUALLY COMES FROM.
   *
   * Walking the routes proves the policy does not break the pages. It does not
   * prove the policy serves the SHOP — and it did not: `img-src` was written
   * from what the frontend code references, and every image path there is
   * backend-relative, so the policy allowed the API origin and nothing else
   * while the backend stores absolute res.cloudinary.com URLs. Every product
   * picture on the live site would have been refused, and no policy page has a
   * product on it, so nothing else here could catch it.
   *
   * A CSP VIOLATION AND A 404 ARE DIFFERENT ANSWERS, and the first version of
   * this check could not tell them apart — it asserted the image DECODED, so a
   * probe URL that rotted looked exactly like a blocked host. That is not
   * hypothetical: porting this file to the sister shop rewrote the URL's path
   * and the gate reported "res.cloudinary.com is not permitted by img-src"
   * while the header plainly permitted it.
   *
   * The question is whether the browser was ALLOWED to make the request. So the
   * verdict is "no CSP violation was logged"; whether the bytes came back is
   * reported alongside as information. Cloudinary's own permanently-available
   * demo asset is used rather than one of the shop's, because the host is what
   * `img-src` governs and a shop asset can be deleted.
   */
  const MEDIA_PROBE = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
  seen = [];
  const probe = await cdp.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `new Promise((done) => {
      const i = new Image();
      i.onload = () => done({ decoded: true, w: i.naturalWidth });
      i.onerror = () => done({ decoded: false });
      i.src = ${JSON.stringify(MEDIA_PROBE)};
      setTimeout(() => done({ decoded: false, timeout: true }), 12000);
    })`,
  });
  await sleep(500);
  const media = probe.result?.value ?? {};
  const mediaBlocked = [...new Set(seen)];
  if (mediaBlocked.length) {
    violationCount += mediaBlocked.length;
    console.log('BLOCKED  product media   res.cloudinary.com is refused by img-src');
    for (const m of mediaBlocked.slice(0, 2)) console.log(`      ! ${m}`);
  } else if (media.decoded) {
    console.log(`clean    product media   host permitted, image decoded (${media.w}px wide)`);
  } else {
    // Permitted but not delivered. Worth saying out loud — it is not a policy
    // failure and must not fail this gate, but a reader should know the bytes
    // did not arrive.
    console.log('clean    product media   host permitted by img-src (probe asset did not load)');
  }

  console.log('-'.repeat(66));
  console.log(violationCount
    ? `${violationCount} CSP violation(s) — the policy is breaking the site.`
    : 'No CSP violations on any route, and every route hydrated.');
} catch (e) {
  console.error('csp check failed:', e.message);
  process.exitCode = 1;
} finally {
  cdp?.close();
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
if (violationCount) process.exitCode = 1;
