#!/usr/bin/env bash
#==============================================================================
# Tez Motors — sync this repo's Asterisk config-as-code into /etc/asterisk and
# reload. Run as root on the VPS after bootstrap.sh. Re-runnable on every change.
# NEVER overwrites the operator-filled secrets (pjsip_secrets.conf, tez.env) —
# those exist only on the box; this just seeds the examples if they're missing.
#==============================================================================
set -euo pipefail
[ "$(id -u)" = "0" ] || { echo "run as root"; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)"

install -d -o asterisk -g asterisk /etc/asterisk/scripts /etc/asterisk/keys /var/spool/asterisk/monitor

# Non-secret config (safe to overwrite on every deploy).
for f in pjsip.conf extensions.conf rtp.conf http.conf; do
  install -m 0640 -o root -g asterisk "$DIR/$f" "/etc/asterisk/$f"
done
install -m 0750 -o root -g asterisk "$DIR/scripts/upload-recording.sh" /etc/asterisk/scripts/upload-recording.sh

# Secrets: seed the example ONCE; never clobber the filled-in copy.
if [ ! -f /etc/asterisk/pjsip_secrets.conf ]; then
  install -m 0640 -o root -g asterisk "$DIR/pjsip_secrets.conf.example" /etc/asterisk/pjsip_secrets.conf
  echo "!! seeded /etc/asterisk/pjsip_secrets.conf — FILL IN the Uztelecom creds before calls work"
fi
if [ ! -f /etc/asterisk/tez.env ]; then
  install -m 0640 -o root -g asterisk "$DIR/tez.env.example" /etc/asterisk/tez.env
  echo "!! seeded /etc/asterisk/tez.env — set CALLS_UPLOAD_SECRET (match the Vostro .env.local)"
fi

# coturn (WebRTC TURN relay).
if [ -f "$DIR/coturn/turnserver.conf" ]; then
  install -m 0644 "$DIR/coturn/turnserver.conf" /etc/turnserver.conf
  systemctl restart coturn 2>/dev/null || true
fi

# Validate + reload (reload is non-disruptive; no dropped calls).
asterisk -rx "pjsip reload"     >/dev/null 2>&1 || true
asterisk -rx "dialplan reload"  >/dev/null 2>&1 || true
asterisk -rx "module reload res_http_websocket.so" >/dev/null 2>&1 || true

echo "applied. verify:"
echo "  asterisk -rx 'pjsip show registrations'   # trunk should be Registered"
echo "  asterisk -rx 'pjsip show endpoints'       # uztelecom + 6001"
echo "  asterisk -rx 'pjsip show identifies'      # provider IP match"
