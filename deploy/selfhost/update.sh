#!/usr/bin/env bash
#
# Tez Motors — one-command deploy on the Vostro.
#
#   ./deploy/selfhost/update.sh                  # pull main + rebuild + restart + health-check
#   ./deploy/selfhost/update.sh --migrate        # also `supabase db push` (one-time per schema bump)
#   ./deploy/selfhost/update.sh --branch=hotfix  # deploy a different branch
#
# Atomic-ish: a failed `npm ci` or build leaves the running service untouched
# (and resets the working tree back to the previous commit). Only after a
# successful build do we restart systemd, then probe the health endpoint.
#
# Wire it once and you can either run it manually over SSH, or let the GitHub
# webhook (deploy/selfhost/update-webhook.mjs) trigger it on every push.
set -euo pipefail

BRANCH="main"
MIGRATE=0
for arg in "$@"; do
  case "$arg" in
    --migrate)      MIGRATE=1 ;;
    --branch=*)     BRANCH="${arg#*=}" ;;
    -h|--help)      sed -n '3,12p' "$0"; exit 0 ;;
    *)              echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

log()  { printf '\n→ %s\n' "$*"; }
ok()   { printf '\n✓ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

PREV_SHA="$(git rev-parse HEAD)"
log "current: $PREV_SHA on $(git rev-parse --abbrev-ref HEAD)"

log "git fetch + reset --hard to origin/$BRANCH"
git fetch --quiet origin "$BRANCH" || fail "git fetch failed (network? credentials?)"
git checkout --quiet "$BRANCH" 2>/dev/null || git checkout --quiet -b "$BRANCH" "origin/$BRANCH"
git reset --quiet --hard "origin/$BRANCH" || fail "git reset failed"
NEW_SHA="$(git rev-parse HEAD)"
if [ "$NEW_SHA" = "$PREV_SHA" ]; then
  ok "already at $NEW_SHA — nothing to do"
  exit 0
fi
log "new: $NEW_SHA"

# --- Build into the working tree. If anything fails, snap back to PREV_SHA so
# the box doesn't sit on a half-applied checkout. The running service is never
# touched until the build is green.
restore_tree() {
  log "rolling working tree back to $PREV_SHA (service NOT restarted)"
  git reset --quiet --hard "$PREV_SHA" || true
}

log "npm ci"
if ! npm ci; then restore_tree; fail "npm ci failed"; fi

log "npm run selfhost:build"
if ! npm run selfhost:build; then restore_tree; fail "build failed"; fi

if [ "$MIGRATE" = 1 ]; then
  log "supabase db push (--include-all)"
  if ! npx --yes supabase db push --include-all; then
    fail "migration push failed — service was NOT restarted; tree is at $NEW_SHA"
  fi
fi

log "systemctl restart tez-motors"
sudo systemctl restart tez-motors || fail "systemctl restart failed"

log "health check (up to 30s)"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/cars?limit=1}"
for i in $(seq 1 30); do
  if curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; then
    ok "deployed $NEW_SHA (was $PREV_SHA)"
    exit 0
  fi
  sleep 1
done
fail "service didn't come up healthy — check 'journalctl -u tez-motors -n 80'"
