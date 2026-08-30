import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getApiBase } from '../api';

/**
 * The API origin, and the invariant that the browser must agree with itself.
 *
 * WHY THIS FILE EXISTS. Two places decide where the backend is: next.config.js
 * builds the Content Security Policy, and lib/api.ts::getApiBase() makes the
 * actual requests. For most of this project's life they were independent —
 * the policy read an environment variable, the code returned a hardcoded
 * Render URL — and nothing anywhere checked they matched.
 *
 * That cost a total outage once (a Razorpay key pasted into NEXT_PUBLIC_API_URL
 * produced a policy that blocked every call to a perfectly healthy backend),
 * and then blocked a migration: setting the variable moved the policy and left
 * the code calling the old host, so the shop could not be pointed at its new
 * API without editing source. Both symptoms are the same defect — two sources
 * of truth for one fact.
 *
 * So the invariant under test is not "the variable is read correctly". It is
 * THE ORIGIN THE CODE CALLS MUST BE ALLOWED BY THE POLICY THE CODE SHIPS. That
 * is the property whose violation is invisible in a build log, invisible in a
 * green deploy, and visible only as a shop that renders and has no data.
 *
 * Node environment, so `window` is undefined and getApiBase() takes its
 * server-side branch — which is the branch that reads the variable. The
 * localhost branch is deliberately not reachable here; it is a hostname check
 * with no configuration in it.
 */

const require_ = createRequire(import.meta.url);
const CONFIG = path.resolve(fileURLToPath(new URL('../../../next.config.js', import.meta.url)));

/** The Render URL is still the fallback until Render is switched off. */
const FALLBACK = 'https://vijey-textile.onrender.com';

/**
 * Load next.config.js fresh against a given environment.
 *
 * The cache must be busted every time: `env` and `images` are evaluated once,
 * when the module is first required, so a cached copy would answer every case
 * with the first case's environment and the test would pass by accident.
 */
async function configFor(value: string | undefined) {
  const before = process.env.NEXT_PUBLIC_API_URL;
  if (value === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = value;

  delete require_.cache[CONFIG];
  const config = require_(CONFIG);
  const headers = await config.headers();
  const csp: string = headers[0].headers.find(
    (h: { key: string }) => h.key === 'Content-Security-Policy',
  ).value;

  const result = {
    baked: config.env.NEXT_PUBLIC_API_URL as string,
    connectSrc: csp.split('; ').find((d) => d.startsWith('connect-src'))!,
    imgSrc: csp.split('; ').find((d) => d.startsWith('img-src'))!,
    imageHosts: config.images.remotePatterns.map((p: { hostname: string }) => p.hostname),
    calls: getApiBase(),
  };

  if (before === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = before;
  return result;
}

afterEach(() => {
  delete require_.cache[CONFIG];
});

describe('the origin the code calls is the origin the policy allows', () => {
  /**
   * The cases that matter are not "valid" and "invalid" — they are the four
   * states this variable is actually found in on a real host: never set,
   * set to the new backend, set by somebody who pasted a URL with a trailing
   * slash, and set to something that is not a URL at all.
   */
  const cases: Array<[name: string, value: string | undefined]> = [
    ['unset', undefined],
    ['the new backend', 'https://api.vijeytextile.com'],
    ['a pasted URL with a trailing slash and a path', 'https://api.vijeytextile.com/api/'],
    ['whitespace around it', '  https://api.vijeytextile.com  '],
    ['not a URL at all', 'rzp_live_abc123'],
  ];

  it.each(cases)('%s — connect-src permits the origin getApiBase() returns', async (_name, value) => {
    const c = await configFor(value);
    expect(c.connectSrc).toContain(c.calls);
  });

  it.each(cases)('%s — img-src permits it too, so pictures load as well as data', async (_name, value) => {
    const c = await configFor(value);
    expect(c.imgSrc).toContain(c.calls);
  });

  it.each(cases)('%s — next/image may optimise from that host', async (_name, value) => {
    const c = await configFor(value);
    expect(c.imageHosts).toContain(new URL(c.calls).hostname);
  });
});

describe('what the variable actually does', () => {
  it('moves the backend when it is a real origin — the whole point of it', async () => {
    const c = await configFor('https://api.vijeytextile.com');
    expect(c.calls).toBe('https://api.vijeytextile.com');
    expect(c.baked).toBe('https://api.vijeytextile.com');
  });

  it('normalises a path, a trailing slash and stray whitespace away', async () => {
    // Somebody copying the health-check URL out of a runbook pastes the path
    // too. An origin with a path appended is not a valid CSP source and would
    // silently weaken the policy rather than fail.
    const c = await configFor('  https://api.vijeytextile.com/api/  ');
    expect(c.calls).toBe('https://api.vijeytextile.com');
    expect(c.baked).toBe('https://api.vijeytextile.com');
  });

  it('falls back rather than shipping a policy built from a Razorpay key', async () => {
    // The original outage, pinned. A value that cannot be an origin must not
    // become one — on either side.
    const c = await configFor('rzp_live_abc123');
    expect(c.calls).toBe(FALLBACK);
    expect(c.baked).toBe(FALLBACK);
  });

  it('leaves the shop on its existing backend when nothing is set', async () => {
    // Cutover is a deliberate act. An unset variable must not move a live shop.
    const c = await configFor(undefined);
    expect(c.calls).toBe(FALLBACK);
    expect(c.baked).toBe(FALLBACK);
  });

  it('keeps the old backend allowed during a cutover, so a revert is not an outage', async () => {
    // Pages already in the CDN's cache still call the old origin, and rolling
    // the variable back must not require a policy change to be safe.
    const c = await configFor('https://api.vijeytextile.com');
    expect(c.connectSrc).toContain(FALLBACK);
    expect(c.imageHosts).toContain(new URL(FALLBACK).hostname);
  });

  it('still allows Cloudinary, where the product photographs really live', async () => {
    const c = await configFor('https://api.vijeytextile.com');
    expect(c.imgSrc).toContain('https://res.cloudinary.com');
    expect(c.imageHosts).toContain('res.cloudinary.com');
  });
});
