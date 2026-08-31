#!/usr/bin/env bash
#
# What is running, since when, and is it current.
#
#     ./status.sh
#
# WHY THIS EXISTS. Render had a Deploys tab: every deploy listed, with its
# commit, its time and whether it succeeded. A plain virtual machine has none of
# that, and the information does not go away — it just stops being in one place.
# This puts it back in one place.
#
# THE QUESTION IT IS REALLY ANSWERING is not "what is the latest commit" but
# "IS THE CODE I PUSHED THE CODE THAT IS SERVING CUSTOMERS". Those come apart in
# two different ways, and both are silent:
#
#   - You pushed, but never ran ./deploy.sh. The machine has not fetched it.
#   - You ran git pull by hand but not the rebuild. The repository is current
#     and the running container is not — the most convincing kind of wrong,
#     because every file you open on the machine shows the new code.
#
# The second is why the container's start time is compared against the commit's
# date rather than just printing both and leaving you to do the arithmetic.

set -uo pipefail

cd "$(dirname "$0")"
VIJEY_REPO="$(cd ../.. && pwd)"
AMMALU_REPO="$(cd ../../../ammalu-tex 2>/dev/null && pwd || true)"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
dim()  { printf '\033[2m%s\033[0m\n' "$1"; }

report() {
  local name="$1" repo="$2" container="$3" url="$4"

  bold "── $name"
  if [ -z "$repo" ] || [ ! -d "$repo/.git" ]; then
    echo "   repository not found"
    return
  fi

  # Deploy history. Git IS the history here — each of these is something that
  # was, or is about to be, deployed.
  dim "   last five commits"
  git -C "$repo" --no-pager log -5 --date=format:'%d %b %H:%M' \
      --format='     %C(auto)%h%Creset  %ad  %s' 2>/dev/null

  # ONLY backend/ COUNTS, and the first version of this script got that wrong.
  # It compared every commit, so a frontend-only change — which is most changes
  # — made both shops report "run ./deploy.sh" when there was nothing whatsoever
  # to deploy. A status line that cries wolf after every push is read carefully
  # twice and ignored thereafter, which is worse than no status line: it
  # occupies the place where a real warning would be seen.
  #
  # The containers build from backend/ and nothing else. Everything under
  # frontend/ is Vercel's, and its state here is genuinely irrelevant.
  local backend_sha backend_epoch started started_epoch
  backend_sha="$(git -C "$repo" log -1 --format=%h -- backend/ 2>/dev/null)"
  backend_epoch="$(git -C "$repo" log -1 --format=%ct -- backend/ 2>/dev/null || echo 0)"
  echo "   last backend   $(git -C "$repo" log -1 --date=format:'%d %b %H:%M' \
        --format='%h  %ad  %s' -- backend/ 2>/dev/null)"

  started="$(docker inspect -f '{{.State.StartedAt}}' "$container" 2>/dev/null || true)"
  if [ -n "$started" ]; then
    started_epoch="$(date -d "$started" +%s 2>/dev/null || echo 0)"
    echo "   running since  $(date -d "$started" '+%d %b %H:%M' 2>/dev/null || echo "$started")"
  else
    started_epoch=0
    echo "   running since  container not found"
  fi

  git -C "$repo" fetch -q 2>/dev/null
  local behind_backend behind_all
  behind_backend="$(git -C "$repo" rev-list --count HEAD..origin/main -- backend/ 2>/dev/null || echo 0)"
  behind_all="$(git -C "$repo" rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"

  if [ "$behind_backend" -gt 0 ]; then
    echo "   ⚠ $behind_backend backend commit(s) pushed but NOT on this machine — run ./deploy.sh"
  elif [ "$started_epoch" -gt 0 ] && [ "$backend_epoch" -gt "$started_epoch" ]; then
    # The subtle one: repository pulled, container never rebuilt. Every file on
    # the machine shows the new code while the container serves the old.
    echo "   ⚠ backend is at $backend_sha but the container started BEFORE it — run ./deploy.sh"
  else
    echo "   ✓ serving current backend code ($backend_sha)"
  fi

  # Worth saying, but not a warning: nothing here is served by this machine.
  if [ "$behind_all" -gt "$behind_backend" ]; then
    dim "   · $((behind_all - behind_backend)) unpulled commit(s) touch only the frontend — Vercel's"
  fi

  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "$url" || true)"
  if [ "$code" = "200" ]; then
    echo "   ✓ healthy over HTTPS"
  else
    echo "   ✗ $url returned ${code:-no response}"
  fi
  echo
}

report "Vijey Textile" "$VIJEY_REPO"  "both-shops-vijey-api-1"  "https://api.vijeytextile.com/health"
report "Ammalu Tex"    "$AMMALU_REPO" "both-shops-ammalu-api-1" "https://api.ammalutex.com/health"

bold "── containers"
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
echo
bold "── disk"
df -h / | awk 'NR==1 || /\/$/ {print "   " $0}'
echo
dim "Frontends are not listed: those deploy from Vercel, and its own"
dim "Deployments tab is the history for them."
