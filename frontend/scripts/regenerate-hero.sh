#!/usr/bin/env bash
# Regenerate the hero from a PRODUCTION build, then verify it.
#
# Everything in here is a lesson that cost a failed run:
#
#   clean .next     a stale build serves 500s for its own chunks, React never
#                   hydrates, and every effect — capture mode, the scene mount —
#                   silently never runs.
#   kill by PORT    a leftover `next start` serving an old .next answers 200 and
#                   fools the health check, so the renderer photographs a corpse.
#                   `pkill -f` does not match reliably on this platform.
#   chunk check     proves the server is serving THIS build, not an old one.
#   production      dev has no static prerender, so useSearchParams-style bugs
#                   hide there, and the dev overlay bakes into every frame.
#
# `npx next build` rather than `npm run build`: the gated script fails on the
# very assets this exists to replace. Nothing here ships — it is a server to
# photograph. The gated build runs at the end and must pass unaided.
set -u
cd "$(dirname "$0")/.."
log() { echo ""; echo "===== $* ====="; }

log "0/5 clean .next"
rm -rf .next

log "1/5 production build"
npx next build 2>&1 | tail -6
[ "${PIPESTATUS[0]}" -ne 0 ] && { echo "ABORT: build failed"; exit 1; }

log "2/5 server on 3100, verified fresh"
node -e '
  const { execSync } = require("child_process");
  try {
    const out = execSync("netstat -ano -p tcp").toString();
    const pids = new Set();
    for (const line of out.split("\n"))
      if (/:3100\s/.test(line) && /LISTENING/i.test(line)) {
        const p = line.trim().split(/\s+/).pop();
        if (p && p !== "0") pids.add(p);
      }
    for (const p of pids) { console.log("killing stale listener " + p); try { execSync("taskkill /F /PID " + p); } catch {} }
    if (!pids.size) console.log("port 3100 free");
  } catch (e) { console.log("port check skipped: " + e.message); }
'
sleep 2
npx next start -p 3100 >/tmp/hero-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ || true)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server: ${code:-none} after ${i}s"
[ "${code:-}" != "200" ] && { echo "ABORT: no server"; exit 1; }
kill -0 "$SERVER_PID" 2>/dev/null || { echo "ABORT: our server died; something else holds 3100"; exit 1; }

chunk=$(curl -s http://localhost:3100/ | grep -oE "/_next/static/chunks/[a-zA-Z0-9_~.-]+\.js" | head -1)
cstat=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100${chunk}" || true)
echo "chunk: ${cstat}"
[ "$cstat" != "200" ] && { echo "ABORT: stale build being served"; exit 1; }

curl -s -o /dev/null "http://localhost:3100/?effects=hold&capture=1" || true
sleep 3

log "3/5 render 120 frames at 4K"
node scripts/render-sequence.mjs --url http://localhost:3100 2>&1 | tail -5
[ "${PIPESTATUS[0]}" -ne 0 ] && { echo "ABORT: render failed"; exit 1; }

log "4/5 encode the ladder"
node scripts/encode-sequence.mjs 2>&1 | tail -8
[ "${PIPESTATUS[0]}" -ne 0 ] && { echo "ABORT: encode failed"; exit 1; }

log "5/5 gates, unaided"
node scripts/check-hero-assets.js 2>&1 | tail -8;               echo "HERO EXIT=${PIPESTATUS[0]}"
node scripts/check-frame-content.mjs public/hero --sample 3 2>&1 | tail -4; echo "FRAMES EXIT=${PIPESTATUS[0]}"
echo "PIPELINE DONE"
