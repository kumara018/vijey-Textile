/**
 * Per-route measurement, in a real GPU-backed browser.
 *
 * Produces the table the final audit needs, one row per route:
 *   fps          — frames actually presented over a 3s window
 *   calls / tris — renderer.info at the end of that window
 *   scene        — OWNS (a live canvas is mounted here) or INHERITS
 *                  (no canvas; the route rides the shared static ground)
 *   errors       — anything the page logged as an error
 *
 * SCENE OWNERSHIP IS THE POINT, not a footnote. Most routes do not mount a
 * scene at all: the canvas is one persistent element in the root layout, and
 * `ThreeProvider` returns null below the `rich` rung, on `/`, and wherever a
 * route has no scene of its own. Reporting "60fps" for a route with no canvas
 * would be reporting the browser's idle loop and calling it a graphics result.
 * So every row says which it is, and a route that inherits reports no draw
 * calls rather than zero — the distinction between "nothing to draw" and
 * "drew nothing".
 *
 * Run against a PRODUCTION build (`next build && next start`): dev-mode React
 * double-renders and Turbopack's HMR socket both distort the numbers.
 *
 *   node scripts/measure-routes.mjs --url http://localhost:3000 --out measure.json
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromePath } from './chrome-path.mjs';
import { publicRoutes, assertRoutesExist } from './routes.mjs';

const CHROME = chromePath();
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const BASE = arg('url', 'http://localhost:3000');
const OUT = arg('out', null);
const WINDOW_MS = Number(arg('window', 3000));
const PORT = 9700;
/** Which adapter Chrome is told to prefer. Run twice: iGPU and discrete. */
const GPU = arg('gpu', 'high-performance'); // or 'low-power'

/**
 * Public routes only. Anything behind auth measures the sign-in screen, which
 * would be a false row — those are covered by the keyboard/reduced-motion pass
 * against a signed-in session instead.
 */
const ROUTES = arg('routes', null)
  ? arg('routes').split(',').map((r) => (r.startsWith('/') ? r : '/' + r))
  : publicRoutes(new URL('../src/app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The route list is derived from the App Router, and the server is asked to
 * confirm it before anything is measured. Both halves matter: a hand-written
 * list drifts, and Next answers an unknown path with a soft 404 that has a
 * heading, links and focus rings — so a gate reading the DOM cannot tell it
 * from a real page. Five entries in the old hardcoded list were doing exactly
 * that. See scripts/routes.mjs.
 */
const missingRoutes = await assertRoutesExist(BASE, ROUTES);
if (missingRoutes.length) {
  console.error('routes the server does not serve — refusing to measure them:');
  for (const m of missingRoutes) console.error(`  ! ${m}`);
  process.exit(1);
}


const profile = mkdtempSync(join(tmpdir(), 'measure-'));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--window-size=1440,900',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
  `--force_high_performance_gpu=${GPU === 'high-performance' ? '1' : '0'}`,
  '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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
    const listeners = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? j(new Error(JSON.stringify(msg.error))) : r(msg.result);
      } else if (msg.method) {
        for (const fn of listeners) fn(msg);
      }
    };
    ws.onerror = () => rej(new Error('ws error'));
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((r, j) => {
        pending.set(++id, { resolve: r, reject: j });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      on: (fn) => listeners.push(fn),
      close: () => ws.close(),
    });
  });
}

let cdp;
const rows = [];
try {
  const t = await target();
  cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  let errors = [];
  cdp.on((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params?.exceptionDetails?.text ?? 'exception');
    } else if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
      errors.push(msg.params.entry.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      errors.push((msg.params.args ?? []).map((a) => a.value ?? a.description ?? '?').join(' '));
    }
  });

  console.log(`GPU preference: ${GPU}\n`);
  console.log('route                     fps   calls   tris    scene      errors');
  console.log('─'.repeat(72));

  for (const route of ROUTES) {
    errors = [];
    await cdp.send('Page.navigate', { url: `${BASE}${route}?measure=1` });
    /**
     * Settle before counting.
     *
     * Five seconds was enough when the homepage had no canvas. It is not now:
     * the route has to resolve a tier, dynamically import the canvas, fetch and
     * decode the hero texture, and clear the frame governor's six-second
     * warm-up. Measured at 5s the homepage reported "inherits · 12fps" — no
     * scene mounted and a frame rate taken mid-startup — which reads as a
     * catastrophic regression and is entirely an artefact of asking too early.
     * Twelve seconds puts every route in steady state, which is the only state
     * worth reporting.
     */
    await sleep(12000);

    // Count presented frames over the window using rAF, which only fires on a
    // compositing frame. This measures what the user sees, not what a timer
    // claims.
    const measured = await cdp.send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `new Promise((done) => {
        const r = window.__three;
        if (r && r.info) r.info.reset();
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - t0 < ${WINDOW_MS}) requestAnimationFrame(tick);
          else {
            const el = performance.now() - t0;
            const info = r && r.info ? r.info : null;
            done({
              fps: +(frames / (el / 1000)).toFixed(1),
              calls: info ? info.render.calls : null,
              tris:  info ? info.render.triangles : null,
              owns:  !!document.querySelector('[data-capture-keep] canvas'),
            });
          }
        };
        requestAnimationFrame(tick);
      })`,
    });

    const m = measured.result?.value ?? {};
    const scene = m.owns ? 'OWNS' : 'inherits';
    rows.push({ route, gpu: GPU, ...m, scene, errors: [...errors] });
    console.log(
      `${route.padEnd(24)} ${String(m.fps ?? '—').padStart(5)} ` +
      `${String(m.owns ? m.calls ?? 0 : '—').padStart(7)} ` +
      `${String(m.owns ? m.tris ?? 0 : '—').padStart(7)}   ` +
      `${scene.padEnd(9)}  ${errors.length ? errors.length + ' ✗' : '0'}`,
    );
    for (const e of errors.slice(0, 3)) console.log(`      ✗ ${e.slice(0, 100)}`);
  }

  const owning = rows.filter((r) => r.scene === 'OWNS');
  console.log('─'.repeat(72));
  console.log(`${rows.length} routes · ${owning.length} own a scene · ` +
    `${rows.length - owning.length} inherit · ` +
    `${rows.reduce((n, r) => n + r.errors.length, 0)} console errors`);

  if (OUT) {
    writeFileSync(resolve(OUT), JSON.stringify(rows, null, 2) + '\n');
    console.log(`-> ${OUT}`);
  }
  // A console error on any route is a failure, whatever the frame rate says.
  if (rows.some((r) => r.errors.length)) process.exitCode = 1;
} catch (e) {
  console.error('measure failed:', e.message);
  process.exitCode = 1;
} finally {
  cdp?.close();
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
