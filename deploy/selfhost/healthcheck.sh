#!/usr/bin/env bash
#
# Tez Motors — service liveness probe. Pings the public car-list endpoint; if
# anything other than HTTP 200 comes back, alerts the dealer via Telegram so the
# Vostro being offline doesn't go unnoticed. Run from cron — see SETUP.md §14:
#
#   */5 * * * *  /home/YOUR_USER/tez-motors/deploy/selfhost/healthcheck.sh
#
# Optional STATE_FILE keeps a one-shot guard so flapping doesn't spam: alerts
# only when state transitions UP -> DOWN, and again on DOWN -> UP recovery.
set -u

URL="${HEALTHCHECK_URL:-http://localhost:3000/api/cars?limit=1}"
EXPECT=200
STATE_FILE="${HEALTHCHECK_STATE_FILE:-/tmp/tez-motors-health.state}"
BOT="${TELEGRAM_BOT_TOKEN:-}"
CHAT="${TELEGRAM_CHAT_ID:-}"

CODE="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$URL" || echo 000)"
NOW="$(date -u +%FT%TZ)"
PREV="$(cat "$STATE_FILE" 2>/dev/null || echo UNKNOWN)"

if [ "$CODE" = "$EXPECT" ]; then
  echo "UP" > "$STATE_FILE"
  if [ "$PREV" = "DOWN" ] && [ -n "$BOT" ] && [ -n "$CHAT" ]; then
    curl -fsS -m 8 -X POST "https://api.telegram.org/bot${BOT}/sendMessage" \
      -H "content-type: application/json" \
      -d "{\"chat_id\":\"${CHAT}\",\"text\":\"✅ tezmotors.uz is BACK UP at ${NOW}\"}" >/dev/null || true
  fi
  exit 0
fi

echo "DOWN" > "$STATE_FILE"
echo "tezmotors.uz DOWN (HTTP $CODE) at $NOW" >&2
if [ "$PREV" != "DOWN" ] && [ -n "$BOT" ] && [ -n "$CHAT" ]; then
  curl -fsS -m 8 -X POST "https://api.telegram.org/bot${BOT}/sendMessage" \
    -H "content-type: application/json" \
    -d "{\"chat_id\":\"${CHAT}\",\"text\":\"⚠ tezmotors.uz DOWN (HTTP ${CODE}) at ${NOW}\\n SSH in and run: systemctl status tez-motors\"}" >/dev/null || true
fi
exit 1
