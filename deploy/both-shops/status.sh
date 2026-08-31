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

  local head_sha head_epoch started started_epoch
  head_sha="$(git -C "$repo" rev-parse --short HEAD)"
  head_epoch="$(git -C "$repo" log -1 --format=%ct)"

  started="$(docker inspect -f '{{.State.StartedAt}}' "$container" 2>/dev/null || true)"
  if [ -n "$started" ]; then
    started_epoch="$(date -d "$started" +%s 2>/dev/null || echo 0)"
    echo "   running since  $(date -d "$started" '+%d %b %H:%M' 2>/dev/null || echo "$started")"
  else
    started_epoch=0
    echo "   running since  container not found"
  fi

  # Is the machine behind the remote?
  git -C "$repo" fetch -q 2>/dev/null
  local behind
  behind="$(git -C "$repo" rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"

  if [ "$behind" -gt 0 ]; then
    echo "   ⚠ $behind commit(s) pushed but NOT on this machine — run ./deploy.sh"
  elif [ "$started_epoch" -gt 0 ] && [ "$head_epoch" -gt "$started_epoch" ]; then
    # The subtle one: repository current, container built before that commit.
    echo "   ⚠ repo is at $head_sha but the container started BEFORE it — run ./deploy.sh"
  else
    echo "   ✓ serving $head_sha"
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
