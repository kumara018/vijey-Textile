import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Where Chrome actually is, on whatever machine this is.
 *
 * Every browser-driving script here began with the same hardcoded Windows
 * path. That was fine while they all ran on one laptop, and became a bug the
 * moment the CSP check was wired into CI: GitHub's runners are ubuntu, the
 * path does not exist there, and the step fails with ENOENT on a spawn — which
 * looks nothing like "your policy is wrong" and would send the next person
 * debugging the CSP instead of the path.
 *
 * Resolution order, most specific first:
 *   1. CHROME_PATH — an explicit override always wins, for anyone with a
 *      non-standard install or a pinned build.
 *   2. Puppeteer's own env var, since CI images often set it.
 *   3. The usual locations per platform.
 *   4. Whatever `which` finds on PATH.
 *
 * Throws with the list it tried rather than returning undefined: a spawn of
 * `undefined` fails much further from the cause.
 */
const CANDIDATES = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
};

export function chromePath() {
  const explicit = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const tried = [];
  for (const p of CANDIDATES[process.platform] ?? []) {
    tried.push(p);
    if (p && existsSync(p)) return p;
  }

  // Last resort: ask the shell. Cheap, and covers unusual installs.
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chrome']) {
    try {
      const found = execSync(
        process.platform === 'win32' ? `where ${name}` : `which ${name}`,
        { stdio: ['ignore', 'pipe', 'ignore'] },
      ).toString().split('\n')[0].trim();
      if (found && existsSync(found)) return found;
    } catch {}
    tried.push(`(PATH) ${name}`);
  }

  throw new Error(
    `Chrome not found on ${process.platform}. Set CHROME_PATH. Tried:\n  ` + tried.join('\n  '),
  );
}
