#!/bin/sh
# Fire one cron route on the self-hosted app with the shared bearer secret.
# Used by the Docker "cron" sidecar (and runnable from a host crontab too).
#   fire-cron.sh /api/cron/rates
set -eu
: "${APP_URL:?APP_URL not set}"
: "${CRON_SECRET:?CRON_SECRET not set}"
route="$1"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}${route}" || echo "ERR")
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') cron ${route} -> ${code}"
