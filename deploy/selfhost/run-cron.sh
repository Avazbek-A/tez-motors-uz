#!/bin/sh
# Host crontab wrapper for the tez-motors scheduled jobs (/api/cron/*).
#
# Resolves CRON_SECRET from the app's .env.local by reading ONLY that key — we
# must NOT `source` the whole file, because it can contain shell-unsafe values
# (e.g. `VAPID_SUBJECT=mailto: <addr>`) that abort a POSIX `.`/`source`. Then it
# points at the locally-running app and fires one guarded route via fire-cron.sh.
#
#   run-cron.sh /api/cron/rates
#
# Self-host crontab usage (see SETUP.md §7) — call it from the deployed tree:
#   0 1 * * *  /home/<user>/tez-motors/deploy/selfhost/run-cron.sh /api/cron/rates >> ~/subs/cron.log 2>&1
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../.." && pwd)"
export APP_URL="${APP_URL:-http://127.0.0.1:3000}"
export CRON_SECRET="$(grep -E '^CRON_SECRET=' "$REPO/.env.local" | cut -d= -f2- | tr -d '\r')"
exec sh "$DIR/fire-cron.sh" "$1"
