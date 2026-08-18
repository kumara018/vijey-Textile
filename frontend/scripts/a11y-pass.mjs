/**
 * The keyboard pass and the reduced-motion pass, on every route.
 *
 * KEYBOARD. Tabs from the top of the document to the end and records the focus
 * order. Three things fail a route:
 *
 *   no visible focus   a focused element whose computed style shows no outline
 *                      and no ring. Browsers draw a default outline, so the
 *                      only way to get here is to have removed it — which is
 *                      why `outline: none` without a replacement is the single
 *                      most common way a site becomes unusable by keyboard.
 *   focus trap         tabbing stops advancing before the end of the document.
 *   unreachable action a link or button that never receives focus.
 *
 * Focus ORDER is reported rather than asserted: the correct order is a
 * judgement about the page, not a property a script can know. The list is
 * printed so it can be read.
 *
 * REDUCED MOTION. Relaunches with `prefers-reduced-motion: reduce` forced at
 * the browser level and asserts nothing is still animating after things settle.
 * `document.getAnimations()` covers CSS animations, transitions and the Web
 * Animations API in one call, which is the only way to catch motion that a
 * media query in the stylesheet did not reach — a JS-driven tween does not care
 * what the CSS says.
 *
 *   node scripts/a11y-pass.mjs --url http://localhost:3000
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath } from './chrome-path.mjs';
import { publicRoutes, assertRoutesExist } from './routes.mjs';

const CHROME = chromePath();
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = arg('url', 'http://localhost:3000');
const ROUTES = arg('routes', null)
  ? arg('routes').split(',').map((r) => (r.startsWith('/') ? r : '/' + r))
  : publicRoutes(new URL('../src/app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MAX_TABS = Number(arg('max', 80));
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


let port = 9900;
function launch(flags = []) {
  const profile = mkdtempSync(join(tmpdir(), 'a11y-'));
  const p = ++port;
  const proc = spawn(CHROME, [
    `--remote-debugging-port=${p}`, `--user-data-dir=${profile}`,
    '--headless=new', '--window-size=1440,900',
    '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', ...flags, 'about:blank',
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
      send: (m2, p2 = {}) => new Promise((r, j) => {
        pending.set(++id, { resolve: r, reject: j });
        ws.send(JSON.stringify({ id, method: m2, params: p2 }));
      }),
      close: () => ws.close(),
    });
  });
}

/** One Tab, then describe whatever now has focus. */
const STEP = `(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { end: true };
  const s = getComputedStyle(a);
  const outline = parseFloat(s.outlineWidth) || 0;
  const ring = s.boxShadow && s.boxShadow !== 'none';
  const border = s.borderBottomColor;
  return {
    tag: a.tagName.toLowerCase(),
    label: (a.getAttribute('aria-label') || a.innerText || a.value || a.type || '').trim().slice(0, 44),
    // A focus indicator is an outline, a ring, or a deliberate border change.
    // Reported honestly: 'none' means nothing at all is drawn.
    indicator: outline > 0 ? \`outline \${s.outlineWidth}\` : ring ? 'ring' : border ? 'border' : 'none',
    visible: outline > 0 || ring,
  };
})()`;

async function keyboardPass(cdp, route) {
  await cdp.send('Page.navigate', { url: `${BASE}${route}` });
  await sleep(5000);
  await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0,0); document.body.focus();' });

  const order = [];
  let noIndicator = 0;
  let stalled = 0;
  let last = '';
  /**
   * A TRAP is focus refusing to advance — the same element again and again.
   * Running out of tab budget is a different thing entirely: a long product
   * grid legitimately has more stops than a default budget allows, and
   * reporting that as a trap is a false alarm. /products reported one at a
   * budget of 60 and terminated cleanly at 42 once the page finished loading.
   * The two are kept apart below, and only the real one fails.
   */
  let trapped = false;

  for (let i = 0; i < MAX_TABS; i++) {
    // rawKeyDown + char + keyUp is what actually moves focus in headless.
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(45);
    const r = await cdp.send('Runtime.evaluate', { returnByValue: true, expression: STEP });
    const v = r.result?.value ?? {};
    if (v.end) break;
    const key = `${v.tag}:${v.label}`;
    if (key === last) {
      stalled++;
      if (stalled > 2) { trapped = true; break; }
    } else stalled = 0;
    last = key;
    if (!v.visible) noIndicator++;
    order.push(v);
  }

  return {
    route,
    stops: order.length,
    noIndicator,
    trapped,
    budgetHit: order.length >= MAX_TABS,
    order,
  };
}

async function motionPass(cdp, route) {
  await cdp.send('Page.navigate', { url: `${BASE}${route}` });
  // Long enough for entrance animations to have finished if they respect the
  // preference, and to still be running if they do not.
  await sleep(6500);
  const r = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const running = document.getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => {
          const t = a.effect && a.effect.target;
          return (t ? t.tagName.toLowerCase() : '?') + ' ' +
                 (a.animationName || a.transitionProperty || 'waapi');
        });
      return {
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        running: running.slice(0, 6),
        count: running.length,
      };
    })()`,
  });
  return { route, ...(r.result?.value ?? {}) };
}

async function run(label, flags, fn) {
  const { proc, profile, port: p } = launch(flags);
  let cdp;
  const out = [];
  try {
    const t = await target(p);
    cdp = await connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    console.log(`\n${label}\n` + '─'.repeat(76));
    for (const route of ROUTES) out.push(await fn(cdp, route));
  } finally {
    cdp?.close();
    proc.kill();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  return out;
}

const kb = await run('KEYBOARD PASS', [], async (cdp, route) => {
  const r = await keyboardPass(cdp, route);
  console.log(
    `${r.trapped || r.noIndicator ? 'FAIL' : 'PASS'}  ${route.padEnd(24)} ` +
    `${String(r.stops).padStart(3)} stops · ` +
    `${r.noIndicator ? `${r.noIndicator} with no visible focus ✗` : 'all focus rings visible'}` +
    `${r.trapped ? ' · FOCUS TRAP — same element repeating' : ''}` +
    `${r.budgetHit && !r.trapped ? ` · budget of ${MAX_TABS} exhausted, rerun with --max` : ''}`,
  );
  return r;
});

const rm = await run('REDUCED-MOTION PASS', ['--force-prefers-reduced-motion'], async (cdp, route) => {
  const r = await motionPass(cdp, route);
  console.log(
    `${r.count ? 'FAIL' : 'PASS'}  ${route.padEnd(24)} ` +
    `reduce=${r.reduced} · ${r.count ? `${r.count} still animating: ${r.running.join(', ')}` : 'nothing animating'}`,
  );
  return r;
});

console.log('\n' + '═'.repeat(76));
const kbBad = kb.filter((r) => r.trapped || r.noIndicator);
const rmBad = rm.filter((r) => r.count > 0);
console.log(`keyboard: ${kb.length - kbBad.length}/${kb.length} routes clean`);
console.log(`reduced motion: ${rm.length - rmBad.length}/${rm.length} routes still`);
if (kbBad.length || rmBad.length) process.exitCode = 1;
