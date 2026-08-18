/**
 * Screenshot a route at several scroll positions, in a REAL compositing
 * browser.
 *
 * The in-app preview pane does not composite — `visibilityState` is hidden and
 * requestAnimationFrame never fires — so anything driven by rAF (the hero
 * scrub, the scale, the scene fade) measures as frozen there and screenshots
 * time out. That is a property of the harness, not of the page, and it made
 * "does the hero actually grow?" unanswerable.
 *
 * This reuses the renderer's CDP machinery against a headless-but-GPU Chrome,
 * which composites properly. Same technique that produced the hero frames, so
 * it is already known to work on this machine.
 *
 *   node scripts/shoot-page.mjs --url http://localhost:3100/ --out /tmp/shots
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromePath } from './chrome-path.mjs';

const CHROME = chromePath();

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const URL_BASE = arg('url', 'http://localhost:3100/');
const OUT = resolve(arg('out', '/tmp/shots'));
const WIDTH = Number(arg('width', 1440));
const HEIGHT = Number(arg('height', 900));
const PORT = 9600;
/** Fractions of a viewport to stop at. */
const STOPS = (arg('stops', '0,0.7,1.4,2.1,2.8,3.6,5,7')).split(',').map(Number);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'shoot-'));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  `--window-size=${WIDTH},${HEIGHT}`,
  '--ignore-gpu-blocklist',
  '--enable-gpu',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
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
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? j(new Error(JSON.stringify(msg.error))) : r(msg.result);
      }
    };
    ws.onerror = () => rej(new Error('ws error'));
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((r, j) => {
        pending.set(++id, { resolve: r, reject: j });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      close: () => ws.close(),
    });
  });
}

let cdp;
try {
  mkdirSync(OUT, { recursive: true });
  const t = await target();
  cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  const consoleErrors = [];
  await cdp.send('Runtime.addBinding', { name: '__noop' }).catch(() => {});

  await cdp.send('Page.navigate', { url: URL_BASE });
  await sleep(9000);

  /**
   * SCROLL WITH REAL WHEEL EVENTS, NOT window.scrollTo.
   *
   * Lenis owns the scroll position. It reads wheel input, interpolates toward a
   * virtual target, and writes the result to scrollTop on its own rAF — so a
   * `window.scrollTo` is overwritten on the very next frame and the page snaps
   * straight back. Every stop in this script was silently landing at y=0 and
   * screenshotting the same top-of-page frame seven times, which made the run
   * look successful and told us nothing.
   *
   * Synthesised wheel events go in the front of that pipeline instead of behind
   * it, so the page moves the way a customer's mouse moves it — through the
   * same easing, with the same settle.
   */
  const evalValue = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { returnByValue: true, expression: expr });
    return r.result?.value;
  };

  async function scrollTo(targetY) {
    for (let i = 0; i < 12; i++) {
      const cur = await evalValue('Math.round(scrollY)');
      const delta = targetY - cur;
      if (Math.abs(delta) < 10) break;
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: Math.round(WIDTH / 2), y: Math.round(HEIGHT / 2),
        deltaX: 0, deltaY: delta,
        pointerType: 'mouse',
      });
      // Lenis lerps at 0.1 per frame; ~30 frames is comfortably converged.
      await sleep(500);
    }
    await sleep(700);
  }

  for (const [n, mult] of STOPS.entries()) {
    await scrollTo(Math.round(HEIGHT * mult));

    const probe = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const sec = document.querySelector('[data-hero-section]');
        let p = null;
        if (sec) {
          const r = sec.getBoundingClientRect();
          const span = r.height - innerHeight;
          p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
        }
        const hero = document.querySelector('[data-sequence-hero]');
        const under = hero && hero.firstElementChild
          ? Number(getComputedStyle(hero.firstElementChild).opacity).toFixed(2) : 'none';
        const shell = document.querySelector('[data-capture-keep]');
        const cvs = shell && shell.querySelector('canvas');
        return {
          y: Math.round(scrollY),
          p: p === null ? 'none' : p.toFixed(3),
          under,
          canvas: cvs ? cvs.width + 'x' + cvs.height : 'none',
          scene: shell ? Number(getComputedStyle(shell).opacity).toFixed(2) : 'none',
          docH: document.documentElement.scrollHeight,
        };
      })()`,
    });
    const info = probe.result?.value ?? {};

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const name = `stop-${String(n).padStart(2, '0')}-y${info.y}-p${info.p}.png`;
    writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
    console.log(
      `  ${name.padEnd(30)} heroProgress=${info.p}  poster=${info.under}  ` +
      `scene=${info.scene}  canvas=${info.canvas}`,
    );
  }

  // Anything the page logged as an error is a real defect, not a measurement.
  const errs = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `window.__errors ? window.__errors.slice(0, 10) : []`,
  });
  console.log('\n  page errors:', JSON.stringify(errs.result?.value ?? []));
  console.log(`  -> ${OUT}`);
} catch (e) {
  console.error('shoot failed:', e.message);
  process.exitCode = 1;
} finally {
  cdp?.close();
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
