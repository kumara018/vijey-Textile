/**
 * Screenshot a page that requires a signed-in customer.
 *
 * shoot-page.mjs cannot reach /account, /orders, /wishlist or /admin: they all
 * redirect to the sign-in page, so every attempt photographs the login form
 * instead and the run still reports success. That is the same class of silent
 * failure the scroll bug in shoot-page.mjs had.
 *
 * This signs in against the API first, writes the token into localStorage on
 * the page's own origin BEFORE the app boots, and only then navigates. The
 * order matters: AuthContext reads localStorage during its first effect, so a
 * token written after navigation arrives too late and the redirect has already
 * fired.
 *
 *   node scripts/shoot-auth.mjs --url http://localhost:3000/account \
 *     --api http://localhost:8000 --identifier admin@vijeytextile.com \
 *     --password '…' --out /tmp/shots [--width 1440] [--height 900] [--y 0]
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromePath } from './chrome-path.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const URL_TARGET = arg('url', 'http://localhost:3000/account');
const API = arg('api', 'http://localhost:8000');
const IDENT = arg('identifier', 'admin@vijeytextile.com');
const PASSWORD = arg('password', '');
const OUT = resolve(arg('out', '/tmp/shots-auth'));
const WIDTH = Number(arg('width', 1440));
const HEIGHT = Number(arg('height', 900));
const Y = Number(arg('y', 0));
const NAME = arg('name', 'auth');
/* Optional: a JS expression run after load and before the shot, for states
   that only exist behind an interaction — an overlay, a menu, a dialog. The
   Browser pane cannot composite in this environment, so a headless click is
   the only way to photograph one. */
const CLICK = arg('click', '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: IDENT, password: PASSWORD }),
  });
  const body = await res.json();
  /* A failed sign-in is not always fatal. Public pages — the shelf, a piece,
     search — photograph perfectly well signed out, and refusing to run because
     the auth rate limiter (correctly) throttled a scripted login would mean the
     tool blocks on a system working as designed. Signed-in-only pages still
     report the bounce further down. */
  const { access_token, user } = body ?? {};
  if (!access_token) {
    console.log(`  NOT signed in (${body?.detail ?? 'no token'}) — continuing signed out`);
  } else {
    console.log(`  signed in as ${user?.email ?? IDENT}${user?.is_admin ? ' (admin)' : ''}`);
  }

  mkdirSync(OUT, { recursive: true });
  const origin = new URL(URL_TARGET).origin;

  /**
   * Same flags as shoot-page.mjs, and the two that matter are not cosmetic.
   *
   * `--disable-gpu` was the first attempt and it killed the renderer outright —
   * every screenshot came back as Chrome's own "This page couldn't load" crash
   * page while the server was serving 200s. This site runs a persistent WebGL
   * canvas in the root layout, so software-only rasterisation is not a
   * degraded mode here, it is a crash. And a fresh `--user-data-dir` keeps the
   * run from colliding with a real Chrome profile already open on this machine.
   */
  const profile = mkdtempSync(join(tmpdir(), 'shoot-auth-'));
  const chrome = spawn(chromePath(), [
    '--remote-debugging-port=9333',
    `--user-data-dir=${profile}`,
    '--headless=new',
    `--window-size=${WIDTH},${HEIGHT}`,
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    /* Software WebGL fallback for a GPU-less CI runner — without it the
       persistent canvas crashes the renderer and the route never hydrates. */
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let targets;
    for (let i = 0; i < 40; i++) {
      try {
        targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
        if (targets.length) break;
      } catch {}
      await sleep(300);
    }
    const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    /* Node's built-in WebSocket, same as shoot-page.mjs — this repo has no
       `ws` dependency and adding one for a screenshot script would be silly. */
    const { send, close } = await new Promise((res, rej) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
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

    await send('Page.enable');

    /**
     * SET THE VIEWPORT EXACTLY, NOT VIA THE WINDOW.
     *
     * `--window-size=768,1024` gives an inner width of 746 — the frame eats
     * 22px — so every "tablet portrait" run was really 746px and landed in the
     * MOBILE band. A responsive check that silently tests a different
     * breakpoint than the one it names is worse than no check: it reported a
     * layout as broken at `md` when `md` was never active.
     */
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 768,
    });
    await send('Runtime.enable');

    /* Seed the token on the target origin before the app ever boots. A blank
       page on the origin is enough to own its localStorage. */
    await send('Page.navigate', { url: `${origin}/favicon.ico` });
    await sleep(1200);
    if (access_token) {
      await send('Runtime.evaluate', {
        expression: `localStorage.setItem('token', ${JSON.stringify(access_token)});
                     localStorage.setItem('user', ${JSON.stringify(JSON.stringify(user))});
                     document.cookie = 'auth_token=' + ${JSON.stringify(access_token)} + '; path=/';`,
      });
    }

    await send('Page.navigate', { url: URL_TARGET });
    await sleep(9000);

    if (CLICK) {
      /* Report failures. This swallowed them, so a selector that matched
         nothing produced a screenshot of the un-clicked page and a run that
         claimed success — the same class of lying gate as a warning that
         cries wolf. */
      const r = await send('Runtime.evaluate', { expression: CLICK, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        console.log('  CLICK FAILED: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      } else {
        console.log('  click ok' + (r.result?.value !== undefined ? ` -> ${JSON.stringify(r.result.value)}` : ''));
      }
      await sleep(2600);
    }

    if (Y > 0) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: WIDTH / 2, y: HEIGHT / 2,
        deltaX: 0, deltaY: Y, pointerType: 'mouse',
      });
      await sleep(2500);
    }

    const where = await send('Runtime.evaluate', { returnByValue: true, expression: 'location.pathname' });
    console.log(`  landed on ${where.result.value}`);
    /* Only a WARNING if we did not ask to be here. Navigating to a sign-in
       page on purpose — /auth/login?switch=1, say — is not a bounce, and
       flagging it as one teaches you to ignore the warning. */
    if (where.result.value.startsWith('/auth') && !new URL(URL_TARGET).pathname.startsWith('/auth')) {
      console.log('  WARNING: bounced to sign-in — the token did not take.');
    }

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = `${OUT}/${NAME}-${WIDTH}x${HEIGHT}-y${Y}.png`;
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(`  -> ${file}`);
    close();
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
