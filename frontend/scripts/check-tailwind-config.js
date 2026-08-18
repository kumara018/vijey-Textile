#!/usr/bin/env node
/**
 * Fails the build on a duplicate key inside tailwind.config.js.
 *
 * This has bitten twice in this file, both times silently:
 *
 *   1. A second `colors` key was added to `extend`. The later one replaced the
 *      earlier rather than merging, taking the entire maroon palette with it —
 *      every `bg-maroon-*` class stopped existing and the dev server 500'd with
 *      a CSS error pointing at globals.css, nowhere near the actual cause.
 *   2. A second `gold` key was added inside `colors`. Same mechanism, quieter
 *      result: `text-gold-bright` resolved to nothing at all and `border-gold`
 *      silently picked up a completely different scale. Nothing failed. The
 *      wrong colour just shipped.
 *
 * JavaScript object literals allow duplicate keys and neither Node, TypeScript
 * nor Tailwind will warn. This parses the config as source and refuses to let
 * that pass.
 *
 * Run from `npm run build` and `npm run lint`.
 */
const fs = require('node:fs');
const path = require('node:path');

const CONFIG = path.join(__dirname, '..', 'tailwind.config.js');

/**
 * Walks the source tracking brace depth, and records every `key:` seen at each
 * depth alongside the path that reached it. A key is a duplicate when the same
 * name appears twice under the same parent path.
 *
 * Deliberately a scanner rather than a full parse: it only needs to understand
 * braces, strings and comments, and staying small means it cannot itself become
 * a thing that breaks the build for the wrong reason.
 */
function findDuplicates(src) {
  const seen = new Map();      // scope id -> Map<key, line>
  const duplicates = [];
  /**
   * Every `{` opens its own scope with a unique id, so only keys inside the
   * SAME object literal can ever collide.
   *
   * Without the unique id, sibling objects inside an array share a path and
   * collide with each other. tailwind's fontSize entries are
   * `[value, { lineHeight, letterSpacing }]` tuples, so a naive scanner reports
   * every single one as a duplicate of the first — which is worse than no
   * check, because a guard that always fails gets switched off.
   */
  const stack = [];            // { name, id }
  let nextScopeId = 0;

  let depth = 0;
  let line = 1;
  let i = 0;
  // Key most recently opened at each depth, so `colors: {` pushes "colors".
  const pendingKey = [];

  while (i < src.length) {
    const c = src[i];

    if (c === '\n') { line++; i++; continue; }

    // Skip comments.
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }

    // Skip string literals whole — a colon or brace inside one is not syntax.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        if (src[i] === '\n') line++;
        i++;
      }
      i++;
      continue;
    }

    if (c === '{') {
      stack.push({ name: pendingKey[depth] ?? '(root)', id: nextScopeId++ });
      depth++;
      i++;
      continue;
    }

    if (c === '}') {
      depth = Math.max(0, depth - 1);
      stack.pop();
      i++;
      continue;
    }

    // An identifier or quoted name followed by a colon is a key.
    const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i));
    if (m) {
      const key = m[1];
      // Identity is the innermost scope only — two keys collide when they sit
      // in the same object literal, never merely at the same nesting path.
      const scope = stack.length ? stack[stack.length - 1].id : -1;
      const parent = stack.map((s2) => s2.name).join('.') || '(root)';
      if (!seen.has(scope)) seen.set(scope, new Map());
      const bucket = seen.get(scope);
      if (bucket.has(key)) {
        duplicates.push({ key, parent, firstLine: bucket.get(key), againLine: line });
      } else {
        bucket.set(key, line);
      }
      pendingKey[depth] = key;
      i += m[0].length;
      continue;
    }

    i++;
  }

  return duplicates;
}

const src = fs.readFileSync(CONFIG, 'utf8');
const dupes = findDuplicates(src);

if (dupes.length === 0) {
  console.log('tailwind.config.js — no duplicate keys');
  process.exit(0);
}

console.error('\n  tailwind.config.js has duplicate keys.\n');
console.error('  A duplicate does not merge. The later definition silently replaces');
console.error('  the earlier one, so classes from the first quietly stop existing.\n');
for (const d of dupes) {
  console.error(`    "${d.key}" in ${d.parent}`);
  console.error(`      first defined line ${d.firstLine}, redefined line ${d.againLine}`);
}
console.error('\n  Merge them, or give one a different name.\n');
process.exit(1);
