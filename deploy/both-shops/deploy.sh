#!/usr/bin/env bash
#
# Deploy a backend change to one shop, or both.
#
#     ./deploy.sh vijey
#     ./deploy.sh ammalu
#     ./deploy.sh both
#
# WHY THIS EXISTS. On Render a push deployed itself. Here it does not: the
# machine has to be told to fetch the new code and rebuild the image. That is
# the single biggest difference in day-to-day work after the migration, and the
# failure mode is quiet — you push, the site carries on serving the old code,
# and nothing anywhere says the deploy did not happen. So the steps are written
# down once, in the right order, rather than remembered.
#
# THE TWO REPOSITORIES ARE SEPARATE. Ammalu is not a folder inside Vijey; it is
# its own repository cloned as a sibling, and the compose file builds it from
# ../../../ammalu-tex/backend. Pulling only the repo you are standing in is the
# easy mistake: it rebuilds Ammalu's container from code you did not update and
# reports success.
#
# The frontends are NOT deployed from here. Vercel still builds those from a
# push, exactly as before — nothing about that changed.

set -euo pipefail

cd "$(dirname "$0")"
COMPOSE_DIR="$PWD"
VIJEY_REPO="$(cd ../.. && pwd)"
AMMALU_REPO="$(cd ../../../ammalu-tex 2>/dev/null && pwd || true)"

TARGET="${1:-}"
case "$TARGET" in
  vijey|ammalu|both) ;;
  *)
    echo "usage: ./deploy.sh {vijey|ammalu|both}" >&2
    exit 2
    ;;
esac

if [ "$TARGET" != "vijey" ] && [ -z "$AMMALU_REPO" ]; then
  echo "!! Ammalu's repository is not beside Vijey's. Expected ../../../ammalu-tex" >&2
  echo "   Clone it there, or deploy vijey only." >&2
  exit 1
fi

# ── Pull ─────────────────────────────────────────────────────────────────────
# Recorded before and after so the summary can say what actually changed. A
# deploy that pulled nothing is worth knowing about: it usually means the push
# went to a different branch, or to the other repository.
pull_repo() {
  local name="$1" path="$2"
  local before after
  before="$(git -C "$path" rev-parse --short HEAD)"
  echo "== $name: pulling"
  git -C "$path" pull --ff-only
  after="$(git -C "$path" rev-parse --short HEAD)"
  if [ "$before" = "$after" ]; then
    echo "   already at $after — nothing new was pulled"
  else
    echo "   $before -> $after"
    git -C "$path" --no-pager log --oneline "$before..$after" | sed 's/^/     /'
  fi
}

# ── Build and restart ────────────────────────────────────────────────────────
# The backup container is rebuilt alongside the API because it runs the SAME
# image (see docker-compose.yml). Leave it out and the nightly dump quietly
# keeps running last month's code.
rebuild() {
  local shop="$1"
  echo "== $shop: building and restarting"
  docker compose up -d --build "${shop}-api" "${shop}-backup"
}

# ── Prove it came back ───────────────────────────────────────────────────────
# Over the public name, not localhost: this checks the whole path a customer
# uses — Caddy, the certificate, the container and the database — rather than
# just whether a process is listening.
wait_healthy() {
  local shop="$1" url="$2" code
  echo "== $shop: waiting for $url"
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" || true)"
    if [ "$code" = "200" ]; then
      echo "   healthy"
      return 0
    fi
    sleep 2
  done
  echo "   !! still not healthy after 60s (last HTTP code: ${code:-none})" >&2
  echo "   docker compose logs --tail=50 ${shop}-api" >&2
  return 1
}

FAILED=0

if [ "$TARGET" = "vijey" ] || [ "$TARGET" = "both" ]; then
  pull_repo "vijey" "$VIJEY_REPO"
  rebuild vijey
  wait_healthy vijey "https://api.vijeytextile.com/health" || FAILED=1
fi

if [ "$TARGET" = "ammalu" ] || [ "$TARGET" = "both" ]; then
  pull_repo "ammalu" "$AMMALU_REPO"
  rebuild ammalu
  wait_healthy ammalu "https://api.ammalutex.com/health" || FAILED=1
fi

echo
docker compose ps

# Images pile up fast when you deploy often, and a full disk takes the shop
# down in a way that looks like nothing to do with deploying. Dangling layers
# only — nothing in use is touched.
echo
echo "== tidying unused image layers"
docker image prune -f >/dev/null 2>&1 || true
df -h / | awk 'NR==1 || /\/$/ {print "   " $0}'

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "!! One or more shops did not come back healthy. The previous image is" >&2
  echo "   still on the machine: 'docker compose logs' first, and if you need to" >&2
  echo "   go back, check out the last good commit and run this script again." >&2
  exit 1
fi

echo
echo "Done. Frontend changes deploy themselves from Vercel — this script is backends only."
