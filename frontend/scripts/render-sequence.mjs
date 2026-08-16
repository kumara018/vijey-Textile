/**
 * Offline hero-sequence renderer.
 *
 * Drives the real scene in headless Chrome with the postprocessing chain held
 * open, steps the scroll position frame by frame, and writes a PNG per step.
 * Nothing is simulated or approximated: these are the same shaders, the same
 * god rays, the same film LUT the real-time path uses — just rendered once,
 * offline, without a frame budget.
 *
 * That is the whole argument for the image sequence. The chain costs ~10fps on
 * an integrated GPU, which is the hardware most of this shop's customers have.
 * Rendering it here and shipping a decode moves that cost off the customer's
 * device entirely, and lets us spend far MORE on quality than real-time ever
 * could afford.
 *
 * The output is intermediate: PNG, lossless, oversized. encode-sequence.mjs
 * turns it into the delivered ladder.
 *
 *   node scripts/render-sequence.mjs --url http://localhost:3100 --frames 120 --width 3840
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const URL_BASE = arg('url', 'http://localhost:3100');
const FRAMES = Number(arg('frames', 120));
const WIDTH = Number(arg('width', 3840));
const HEIGHT = Math.round((WIDTH * 9) / 16);
const OUT = resolve(arg('out', 'public/hero/raw'));
const PORT = 9500;

/**
 * The scroll span the camera move occupies.
 *
 * The hero section is the first viewport, and the entrance dock's scroll-driven
 * dolly/crane runs across the whole page scroll. Sampling only the first ~45%
 * captures the move while it is still about the garment, before the page has
 * carried on into the editorial sections.
 *
 * Read from the same file SequenceHero reads. These were previously two
 * independent expressions of the same idea — the renderer stepped document
 * scroll 0→0.45, the component scrubbed on element visibility — and the
 * mismatch meant the sequence opened mid-move and ran out one viewport down.
 * One file, both ends.
 */
const SCRUB = JSON.parse(
  readFileSync(new URL('../src/lib/heroScrub.json', import.meta.url), 'utf8'),
);
const SCROLL_FROM = SCRUB.from;
const SCROLL_TO = SCRUB.to;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'seq-render-'));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  `--window-size=${WIDTH},${HEIGHT}`,
  // Real GPU. Forcing SwiftShader here would render the sequence on the CPU
  // and defeat the entire point of rendering it offline.
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

  // effects=hold keeps the full chain open regardless of frame rate. Offline
  // there is no frame budget to protect, so the governor must not intervene.
  await cdp.send('Page.navigate', { url: `${URL_BASE}/?effects=hold&capture=1` });

  // Long settle: fonts, the garment texture, the 130KB LUT, shader compilation
  // and the scene crossfade all have to finish before frame 0. A sequence whose
  // first frames were captured mid-fade is unusable.
  await sleep(20000);

  /**
   * Preconditions, checked in the live page before a single frame is written.
   *
   * This exists because the render has now silently produced unusable output
   * twice — once with the whole page composited into every frame, once with
   * capture mode active but ineffective — and both times the failure was only
   * discovered by opening a PNG afterwards. An hour of GPU time is too
   * expensive to spend on faith.
   *
   * Each of these is a thing that must be TRUE in the page, not a thing the
   * script believes it requested:
   *
   *   capture    — the attribute actually landed (it is applied by a React
   *                effect, so it depends on hydration having finished)
   *   sceneOnly  — the marked canvas host is present and every other body
   *                child is genuinely computed-hidden
   *   heroHidden — the sequence hero is display:none, so the hero cannot end
   *                up photographing its own poster
   *   canvas     — there is a scene canvas with real pixel dimensions, i.e.
   *                the tier override put a real-time scene on screen
   */
  const pre = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const keep = document.querySelector('[data-capture-keep]');
      const canvas = keep && keep.querySelector('canvas');
      const leaked = [...document.body.children]
        .filter(el => !el.hasAttribute('data-capture-keep'))
        .filter(el => el.tagName !== 'SCRIPT')
        .filter(el => getComputedStyle(el).visibility !== 'hidden')
        .map(el => el.tagName + '.' + (el.className || '').toString().slice(0, 30));
      const hero = document.querySelector('[data-sequence-hero]');
      return {
        capture: document.documentElement.getAttribute('data-capture'),
        hasHost: !!keep,
        canvas: canvas ? [canvas.width, canvas.height] : null,
        heroHidden: !hero || getComputedStyle(hero).display === 'none',
        leaked,
      };
    })()`,
  });

  const s = pre.result?.value ?? {};
  const problems = [];
  if (s.capture !== '1') problems.push('capture attribute never applied (hydration?)');
  if (!s.hasHost) problems.push('no [data-capture-keep] canvas host — no real-time scene mounted');
  if (!s.canvas || s.canvas[0] < 2) problems.push(`scene canvas absent or unsized: ${JSON.stringify(s.canvas)}`);
  if (!s.heroHidden) problems.push('sequence hero still visible — it would photograph itself');
  if (s.leaked?.length) problems.push(`DOM still visible: ${s.leaked.join(', ')}`);

  if (problems.length) {
    throw new Error(
      'capture preconditions failed, refusing to render:\n    - ' + problems.join('\n    - '),
    );
  }
  console.log(`  preconditions OK — scene canvas ${s.canvas[0]}x${s.canvas[1]}, DOM stripped`);

  const started = Date.now();
  for (let f = 0; f < FRAMES; f++) {
    const p = FRAMES === 1 ? 0 : f / (FRAMES - 1);
    const scroll = SCROLL_FROM + (SCROLL_TO - SCROLL_FROM) * p;

    await cdp.send('Runtime.evaluate', {
      expression: `window.scrollTo({ top: (document.body.scrollHeight - innerHeight) * ${scroll}, behavior: 'instant' })`,
    });

    /**
     * Let the eased camera actually ARRIVE before capturing.
     *
     * The rig approaches its target exponentially rather than snapping, so a
     * capture taken immediately after a scroll write records the camera still
     * in transit. The sequence would then compress the move non-linearly and
     * scrub with a visible stutter. Waiting per frame is the cost of the move
     * being correctly sampled.
     */
    await sleep(420);

    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(join(OUT, `frame-${String(f).padStart(4, '0')}.png`), Buffer.from(shot.data, 'base64'));

    if (f % 10 === 0 || f === FRAMES - 1) {
      const pct = Math.round(((f + 1) / FRAMES) * 100);
      process.stdout.write(`\r  rendered ${f + 1}/${FRAMES} (${pct}%)   `);
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\n  ${FRAMES} frames at ${WIDTH}x${HEIGHT} -> ${OUT}  (${secs}s)`);
} catch (e) {
  console.error('render failed:', e.message);
  process.exitCode = 1;
} finally {
  cdp?.close();
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
