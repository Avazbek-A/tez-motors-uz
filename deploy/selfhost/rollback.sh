#!/usr/bin/env bash
#
# Roll back to a previous commit and rebuild. Use after a bad deploy.
#
#   ./deploy/selfhost/rollback.sh <sha-or-tag>     # e.g. ./rollback.sh HEAD~1, or a full SHA
#
# NOTE: this rolls the CODE back but NOT the database. If the bad deploy added a
# migration, apply a reverse migration manually before/after. Most app-layer
# changes are safe to revert in either order — schema changes are not.
set -euo pipefail

SHA="${1:-}"; [ -z "$SHA" ] && { sed -n '3,9p' "$0"; exit 2; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

log()  { printf '\n→ %s\n' "$*"; }
ok()   { printf '\n✓ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

PREV_SHA="$(git rev-parse HEAD)"
log "current: $PREV_SHA"

log "git checkout $SHA"
git fetch --quiet origin || true
git checkout --quiet "$SHA" || fail "couldn't check out $SHA"
NEW_SHA="$(git rev-parse HEAD)"
log "rolled back to: $NEW_SHA"

log "npm ci"
npm ci || fail "npm ci failed (you're now on $NEW_SHA — service still on $PREV_SHA build)"
log "npm run selfhost:build"
npm run selfhost:build || fail "build failed (service still on $PREV_SHA build)"

log "systemctl restart tez-motors"
sudo systemctl restart tez-motors || fail "systemctl restart failed"

log "health check"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/cars?limit=1}"
for i in $(seq 1 30); do
  if curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; then ok "rolled back to $NEW_SHA"; exit 0; fi
  sleep 1
done
fail "service not healthy after rollback — 'journalctl -u tez-motors -n 80'"
