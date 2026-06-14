#!/bin/bash
# One-command production deploy for tez-motors.
#
#   ./deploy/deploy.sh
#
# Topology: Mac = dev (commit + push), GitHub = source of truth, Vostro = prod.
# Deploy is git-based + atomic: push to GitHub, then the Vostro hard-resets to
# origin, rebuilds the standalone bundle, and restarts the systemd service.
# The Vostro's .env.local is gitignored and never touched. We do NOT scp files
# anymore (that left macOS ._* junk and a stale git); git reset is reproducible.
#
# Env overrides: DEPLOY_BRANCH, VOSTRO_HOST, REMOTE_DIR.
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-design/cinematic-showroom}"
VOSTRO="${VOSTRO_HOST:-vostro}"
REMOTE_DIR="${REMOTE_DIR:-/home/rayxona/tez-motors}"

# Refuse to deploy a dirty tree — commit first so prod == a real commit.
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ working tree is dirty — commit (and it'll auto-push) before deploying."
  git status --short
  exit 1
fi

echo "==> [1/4] push $BRANCH to GitHub"
git push origin "$BRANCH"

echo "==> [2/4] sync Vostro to origin/$BRANCH + migrate + rebuild"
ssh "$VOSTRO" "set -e
  cd '$REMOTE_DIR'
  git fetch -q origin
  PREV=\$(git rev-parse --short HEAD)
  echo \"   prev: \$PREV\"
  git reset --hard 'origin/$BRANCH'
  echo \"   now:  \$(git rev-parse --short HEAD)\"
  npm install --no-audit --no-fund    # pick up dependency changes (e.g. pg)
  node deploy/migrate.mjs             # apply pending DB migrations BEFORE build; fails closed
  npm run selfhost:build
"

echo "==> [3/4] restart service"
ssh "$VOSTRO" '
  PID=$(systemctl show tez-motors --property=MainPID --value)
  sudo systemctl restart tez-motors 2>/dev/null || kill "$PID" 2>/dev/null || true
  sleep 8
  systemctl show tez-motors --property=MainPID --value | sed "s/^/   new PID: /"
'

echo "==> [4/4] health check"
CODE=$(ssh "$VOSTRO" 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ru/catalog')
if [ "$CODE" = "200" ]; then
  echo "✅ deploy OK (catalog $CODE)"
else
  echo "❌ health check failed (catalog $CODE) — roll back with:"
  echo "   ssh $VOSTRO \"cd $REMOTE_DIR && git reset --hard <prev-sha> && npm run selfhost:build && sudo systemctl restart tez-motors\""
  exit 1
fi
