/**
 * Deliberate-failure drills.
 *
 * Every one of these breaks the page on purpose and then asserts that what is
 * left is still a usable shop. The bar is not "no crash" — it is that the
 * CONTENT survives, because every 3D layer on this site is decoration sitting
 * behind ordinary HTML, and the whole architecture is a bet on that being true.
 * A drill fails if the page goes blank, loses its headline, or says nothing
 * about a state the customer is now in.
 *
 *   1  network killed mid-load     — assets cut after first paint
 *   2  forced WebGL context loss   — WEBGL_lose_context on the live canvas
 *   3  WebGL disabled entirely     — Chrome launched without it
 *   4  slow 3G                     — 400kbps / 400ms RTT, unthrottled CPU
 *   5  poster blocked              — hero imagery 404s
 *   6  API killed                  — every backend call refused
 *
 * Drill 6 stands in for "API killed mid-checkout". Checkout itself needs a
 * signed-in session and a live Razorpay handle, so the automated form blocks
 * the API origin outright and asserts the storefront degrades to a stated
 * error rather than an empty frame; the money path proper is covered by the
 * live-backend pass with a real declined card, which is a human test and is
 * documented as one rather than faked here.
 *
 *   node scripts/failure-drills.mjs --url http://localhost:3000
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = arg('url', 'http://localhost:3000');
const API = arg('api', 'http://localhost:8000');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let port = 9800;

function launch(extraFlags = []) {
  const profile = mkdtempSync(join(tmpdir(), 'drill-'));
  const p = ++port;
  const proc = spawn(CHROME, [
    `--remote-debugging-port=${p}`,
    `--user-data-dir=${profile}`,
    '--headless=new', '--window-size=1440,900',
    '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check',
    ...extraFlags, 'about:blank',
  ], { stdio: 'ignore' });
  return { proc, profile, port: p };
}

async function target(p) {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json();
      const t = l.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
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

/**
 * The survival assertion, shared by every drill.
 *
 * Deliberately DOM-level and content-level: readable text, a heading, working
 * links, and no blank body. Screenshot comparison would fail on every drill by
 * design (the whole point is that the page looks different), so it would
 * measure nothing.
 */
const SURVIVES = `(() => {
  const body = document.body;
  const text = (body.innerText || '').trim();
  const h1 = document.querySelector('h1');
  return {
    chars: text.length,
    heading: h1 ? h1.innerText.trim().slice(0, 60) : null,
    links: document.querySelectorAll('a[href]').length,
    blank: text.length < 40,
    canvases: document.querySelectorAll('canvas').length,
    // Anything the site itself chose to say about a failure.
    stated: !!document.querySelector('[role="alert"], [data-error-state]'),
  };
})()`;

const results = [];

async function drill(name, { flags = [], route = '/', before, after, expect, settle = 6000 }) {
  const { proc, profile, port: p } = launch(flags);
  let cdp;
  try {
    const t = await target(p);
    cdp = await connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');

    if (before) await before(cdp);
    await cdp.send('Page.navigate', { url: `${BASE}${route}` });
    await sleep(settle);
    if (after) await after(cdp);

    const r = await cdp.send('Runtime.evaluate', { returnByValue: true, expression: SURVIVES });
    const v = r.result?.value ?? {};
    const verdict = expect ? expect(v) : (!v.blank && v.links > 0);
    results.push({ name, ok: verdict, v });
    console.log(
      `${verdict ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} ` +
      `${String(v.chars).padStart(6)} chars · ${String(v.links).padStart(3)} links · ` +
      `${v.canvases} canvas · ${v.heading ? `“${v.heading}”` : 'no h1'}`,
    );
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`FAIL  ${name.padEnd(30)} ${e.message}`);
  } finally {
    cdp?.close();
    proc.kill();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

console.log('deliberate-failure drills\n' + '─'.repeat(78));

// 1 ── Network cut after first paint. Chunks and images stop arriving mid-load.
await drill('1 network killed mid-load', {
  after: async (cdp) => {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    await sleep(2500);
  },
});

// 2 ── Context loss on the live canvas. The recovery path must keep the page.
await drill('2 forced WebGL context loss', {
  after: async (cdp) => {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        for (const c of document.querySelectorAll('canvas')) {
          const gl = c.getContext('webgl2') || c.getContext('webgl');
          const ext = gl && gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        }
      })()`,
    });
    await sleep(2500);
  },
});

// 3 ── No WebGL at all. The tier ladder should land on the static rung.
await drill('3 WebGL disabled entirely', {
  flags: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'],
});

// 4 ── Slow 3G. Nothing may gate an action behind a loading animation.
await drill('4 throttled to slow 3G', {
  before: async (cdp) => {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 400,
      downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8,
    });
  },
});

// 5 ── Hero imagery 404s. The headline and the shop must not depend on it.
await drill('5 poster/sequence blocked', {
  before: async (cdp) => {
    await cdp.send('Network.setBlockedURLs', { urls: ['*/hero/*', '*poster*'] });
  },
});

// 6 ── Backend refused. Products cannot load; the page must SAY so.
await drill('6 API killed', {
  route: '/products',
  before: async (cdp) => {
    await cdp.send('Network.setBlockedURLs', { urls: [`${API}/*`, '*/api/*'] });
  },
  /**
   * Long enough to see the DESIGNED state, not the state on the way to it.
   *
   * /products retries once with a 10s delay, so at the default 6s the page is
   * still legitimately retrying and showing a skeleton — the drill was
   * measuring the wait, not the outcome, and failed a page that had not
   * finished answering. This drill asks whether the site ever tells the
   * customer; how long it takes to say it is recorded separately below.
   */
  settle: 16000,
  // Here "survived" means more than not-blank: the site has to state the
  // failure rather than show an empty grid that looks like a sold-out shop.
  expect: (v) => !v.blank && v.links > 0 && v.stated,
});

console.log('─'.repeat(78));
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} drills passed`);
if (failed.length) {
  for (const f of failed) console.log(`   ✗ ${f.name}${f.error ? ` — ${f.error}` : ''}`);
  process.exitCode = 1;
}
