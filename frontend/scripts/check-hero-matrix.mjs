/**
 * Does the hero hold up on every device the shop actually gets?
 *
 * The homepage hero is now a live WebGL scene, and that decision has a cost
 * this gate exists to bound: it behaves differently on six materially different
 * configurations, and the one I develop on is the least representative of them.
 * The customer's complaint that started all of this — a garment that shook, and
 * was cut off — was only ever visible on their machine.
 *
 * Two invariants, checked as facts rather than inferred from a picture:
 *
 *   1. THE HERO IS NEVER BLANK. At every viewport, on every rung of the
 *      delivery ladder, with reduced motion on and with WebGL switched off
 *      entirely, there is either a live canvas drawing or a poster showing.
 *      "Neither" is the failure that puts an empty dark rectangle at the top of
 *      a shop, and it is exactly what the tier ladder used to produce once it
 *      had walked itself to the floor.
 *
 *   2. THE GARMENT IS NEVER CUT. The scene publishes its own framing under
 *      `?measure=1` and this reads it directly. That is deliberate: the
 *      backdrop fills the frame, so no pixel analysis can distinguish a subject
 *      touching the edge from a room that reaches it. Screenshots would have
 *      passed the exact bug that shipped — a plate 7.6 units tall in a frame
 *      6.6 units tall.
 *
 * Run against a PRODUCTION build (`next build && next start`). Dev mode
 * double-renders and the numbers are not the customer's.
 *
 *   node scripts/check-hero-matrix.mjs --url http://localhost:3100
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromePath } from './chrome-path.mjs';

const CHROME = chromePath();
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = arg('url', 'http://localhost:3100');
const SHOTS = arg('shots', null);      // optional: write a PNG per config
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The matrix.
 *
 * `webgl: false` needs its own browser because it is a launch flag, not
 * something CDP can emulate. Everything else is a metrics/media override, so
 * five of the six share one process and one warm cache.
 */
const CONFIGS = [
  { name: 'desktop',        w: 1440, h: 900,  mobile: false, reduced: false, webgl: true  },
  { name: 'laptop',         w: 1280, h: 800,  mobile: false, reduced: false, webgl: true  },
  { name: 'tablet',         w: 820,  h: 1180, mobile: true,  reduced: false, webgl: true  },
  { name: 'phone',          w: 390,  h: 844,  mobile: true,  reduced: false, webgl: true  },
  { name: 'phone-reduced',  w: 390,  h: 844,  mobile: true,  reduced: true,  webgl: true  },
  { name: 'no-webgl',       w: 1280, h: 800,  mobile: false, reduced: false, webgl: false },
];

/** Where in the pinned hero to sample. Start, middle, and just before release. */
const STOPS = [0.02, 0.55, 0.94];

/**
 * How far outside the frame the subject may sit before this fails.
 *
 * Zero would be the honest number, but the scene eases toward its target and a
 * sample taken mid-ease can land a hair past it. A hundredth of a frame is far
 * below anything an eye reads as a crop and far above float noise.
 */
const EDGE_TOLERANCE = 0.01;

function launch(port, webgl) {
  const profile = mkdtempSync(join(tmpdir(), 'heromx-'));
  const proc = spawn(CHROME, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--window-size=1440,900',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    ...(webgl
      ? ['--ignore-gpu-blocklist', '--enable-gpu']
      // Switches off WebGL/WebGPU the way a blocklisted driver does, which is
      // the state this fallback path was written for.
      : ['--disable-3d-apis', '--disable-gpu']),
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  return { proc, profile };
}

async function target(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error(`no page target on ${port}`);
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

/** The probe, run at every stop. Everything this gate asserts comes from here. */
const PROBE = `(() => {
  const sec = document.querySelector('[data-hero-section]');
  let p = null;
  if (sec) {
    const r = sec.getBoundingClientRect();
    const span = r.height - innerHeight;
    p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  }
  const stage = document.querySelector('[data-sequence-hero]');
  const underlay = stage && stage.firstElementChild;
  const img = stage && stage.querySelector('img');
  const shell = document.querySelector('[data-capture-keep]');
  const canvas = shell && shell.querySelector('canvas');
  const sceneOpacity = shell ? Number(getComputedStyle(shell).opacity) : 0;
  const posterOpacity = underlay ? Number(getComputedStyle(underlay).opacity) : 0;
  const h1 = document.querySelector('h1');
  return {
    p: p,
    // "Something is on screen": a canvas that is actually being composited, or
    // a poster that is actually visible. Presence in the DOM is not enough —
    // an opacity-0 layer is a blank hero with extra steps.
    liveScene: !!(canvas && canvas.width > 100 && sceneOpacity > 0.05),
    poster: !!(img && img.naturalWidth > 0 && posterOpacity > 0.05),
    sceneOpacity: +sceneOpacity.toFixed(2),
    posterOpacity: +posterOpacity.toFixed(2),
    tier: img ? (img.currentSrc.match(/hero\\/([a-z]+)\\//) || [])[1] || '?' : '-',
    frame: window.__heroFrame || null,
    headline: h1 ? (h1.textContent || '').trim().slice(0, 24) : null,
    headlineVisible: h1 ? h1.getBoundingClientRect().width > 40 : false,
  };
})()`;

async function runConfig(cdp, cfg, failures, notes) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: cfg.w, height: cfg.h, deviceScaleFactor: 1, mobile: cfg.mobile,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: cfg.reduced ? 'reduce' : 'no-preference' }],
  });

  // Reload rather than navigate-in-place: the delivery tier reads
  // `max-width: 768px` once at mount, and the pinned section is sized in svh.
  // Both have to be re-evaluated at the new metrics or the run measures the
  // previous config's layout under the new one's name.
  await cdp.send('Page.navigate', { url: `${BASE}/?measure=1` });
  // Long enough for detection, the texture, and the governor's 6s warm-up.
  await sleep(11000);

  /**
   * The scrollable span of the pin, read from the page rather than computed.
   *
   * My first version targeted `viewportHeight × 1.9 × stop`, reasoning from the
   * section being 190svh. That is the section's HEIGHT; the distance you can
   * scroll inside the pin is height minus one viewport — 0.9 of a viewport, not
   * 1.9. Every stop past the first overshot to the end and the run reported
   * three samples of which two were the same position. Asking the page removes
   * the arithmetic and survives the section being resized again.
   */
  const span = (await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => { const s = document.querySelector('[data-hero-section]');
      if (!s) return 0;
      return Math.max(0, Math.round(s.getBoundingClientRect().height - innerHeight)); })()`,
  })).result?.value ?? 0;

  if (!span) failures.push(`${cfg.name}: no [data-hero-section] on the page`);

  for (const stop of STOPS) {
    const targetY = Math.round(span * stop);
    for (let i = 0; i < 12; i++) {
      const cur = (await cdp.send('Runtime.evaluate', {
        returnByValue: true, expression: 'Math.round(scrollY)',
      })).result?.value ?? 0;
      const delta = targetY - cur;
      if (Math.abs(delta) < 12) break;
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: Math.round(cfg.w / 2), y: Math.round(cfg.h / 2),
        deltaX: 0, deltaY: delta, pointerType: 'mouse',
      });
      await sleep(420);
    }
    await sleep(800);

    const v = (await cdp.send('Runtime.evaluate', { returnByValue: true, expression: PROBE }))
      .result?.value ?? {};

    const label = `${cfg.name} @ p=${(v.p ?? 0).toFixed(2)}`;

    // ── Invariant 1: something is on screen ──────────────────────────────
    if (!v.liveScene && !v.poster) {
      failures.push(
        `${label}: HERO IS BLANK — no live canvas and no visible poster ` +
        `(scene opacity ${v.sceneOpacity}, poster opacity ${v.posterOpacity}, tier ${v.tier})`,
      );
    }

    // ── Invariant 2: the subject is whole ────────────────────────────────
    if (v.frame) {
      const f = v.frame;
      const out = [];
      if (f.left < -1 - EDGE_TOLERANCE) out.push(`left ${f.left}`);
      if (f.right > 1 + EDGE_TOLERANCE) out.push(`right ${f.right}`);
      if (f.top > 1 + EDGE_TOLERANCE) out.push(`top ${f.top}`);
      if (f.bottom < -1 - EDGE_TOLERANCE) out.push(`bottom ${f.bottom}`);
      if (out.length) {
        failures.push(`${label}: GARMENT CROPPED — outside the frame at ${out.join(', ')}`);
      }
    } else if (v.liveScene) {
      /**
       * The scene is drawing but staged NO GARMENT. That is a failure, not a
       * note, and it was a note until it caught something real.
       *
       * Clearing the seeded products' dead image paths left twenty-four real
       * products with an empty images array. The homepage picked the first
       * product whatever it was, found no photograph on it, and rendered a lit
       * empty room on all six configurations — while every other assertion here
       * passed, because an empty room is neither blank nor cropped and the
       * headline was perfectly legible.
       *
       * A hero with no subject is the thing this gate exists to prevent.
       */
      failures.push(
        `${label}: SCENE HAS NO SUBJECT — the canvas is drawing but no garment ` +
        `is staged (no __heroFrame published)`,
      );
    }

    // ── The copy must survive whatever the scene does ────────────────────
    if (!v.headlineVisible) {
      failures.push(`${label}: HEADLINE NOT VISIBLE (${JSON.stringify(v.headline)})`);
    }

    const frameTxt = v.frame
      ? `x[${v.frame.left.toFixed(2)},${v.frame.right.toFixed(2)}] y[${v.frame.bottom.toFixed(2)},${v.frame.top.toFixed(2)}]`
      : '—';
    console.log(
      `  ${cfg.name.padEnd(14)} p=${(v.p ?? 0).toFixed(2)}  ` +
      `${(v.liveScene ? 'scene' : v.poster ? 'poster' : 'NOTHING').padEnd(7)} ` +
      `tier=${String(v.tier).padEnd(9)} ${frameTxt}`,
    );
  }

  // ── Progress must actually reach the end of the pin ────────────────────
  const end = (await cdp.send('Runtime.evaluate', { returnByValue: true, expression: PROBE }))
    .result?.value ?? {};
  if ((end.p ?? 0) < 0.85) {
    failures.push(`${cfg.name}: hero progress stalled at ${(end.p ?? 0).toFixed(2)} — the pin never completes`);
  }

  if (SHOTS) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(resolve(SHOTS), `${cfg.name}.png`), Buffer.from(shot.data, 'base64'));
  }
}

const failures = [];
const notes = [];
const started = [];

try {
  if (SHOTS) mkdirSync(resolve(SHOTS), { recursive: true });
  console.log(`hero matrix against ${BASE}\n${'-'.repeat(78)}`);

  for (const webgl of [true, false]) {
    const group = CONFIGS.filter((c) => c.webgl === webgl);
    if (!group.length) continue;

    const port = webgl ? 9760 : 9761;
    const { proc, profile } = launch(port, webgl);
    started.push({ proc, profile });

    const t = await target(port);
    const cdp = await connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    const errors = [];
    cdp.on((m) => {
      if (m.method === 'Runtime.exceptionThrown') {
        errors.push(m.params?.exceptionDetails?.exception?.description
          ?? m.params?.exceptionDetails?.text ?? 'exception');
      } else if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
        errors.push(m.params.entry.text);
      }
    });

    for (const cfg of group) {
      errors.length = 0;
      await runConfig(cdp, cfg, failures, notes);
      // A page-level exception is a defect whatever the hero looks like.
      // CORS noise from a backend that is not running locally is not.
      const real = errors.filter((e) => !/CORS|ERR_FAILED|ERR_CONNECTION|client-errors/i.test(e));
      if (real.length) {
        failures.push(`${cfg.name}: ${real.length} page error(s) — ${real[0].slice(0, 120)}`);
      }
    }
    cdp.close();
  }

  console.log('-'.repeat(78));
  for (const n of notes) console.log(`  note: ${n}`);
  if (failures.length) {
    console.log(`\n${failures.length} FAILURE(S):`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`hero matrix OK — ${CONFIGS.length} configurations × ${STOPS.length} scroll positions; ` +
      'never blank, never cropped, headline always legible.');
  }
} catch (e) {
  console.error('hero matrix failed to run:', e.message);
  process.exitCode = 1;
} finally {
  for (const s of started) {
    s.proc.kill();
  }
  await sleep(500);
  for (const s of started) {
    try { rmSync(s.profile, { recursive: true, force: true }); } catch {}
  }
}
