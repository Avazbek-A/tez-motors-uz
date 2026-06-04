#!/usr/bin/env bash
#
# Tez Motors — ONE-COMMAND Vostro bootstrap.
#
# Run once on the Ubuntu box, from the repo root:
#     bash deploy/selfhost/bootstrap.sh
#
# It does every automatable step so that afterwards `git push` deploys live:
#   • installs Node 20 (if missing)
#   • ensures .env.local exists + generates UPDATE_WEBHOOK_SECRET
#   • npm ci + selfhost:build
#   • installs & starts the app + auto-deploy webhook as systemd services
#     (templated to THIS user + checkout path)
#   • grants the webhook passwordless `systemctl restart tez-motors`
#   • health-checks the running app
# Idempotent: safe to re-run after a config change. The only manual steps left
# (printed at the end) are the two that genuinely need a human: the Cloudflare
# Tunnel login and pasting the webhook into GitHub.
set -euo pipefail

log()  { printf '\n\033[1;36m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] && fail "Run as your normal user (NOT root). It will sudo only where needed."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"
RUN_USER="$(id -un)"
NODE_BIN="$(command -v node || true)"
SYSTEMCTL="$(command -v systemctl || echo /usr/bin/systemctl)"
ENV_FILE="$PROJECT_ROOT/.env.local"
log "checkout: $PROJECT_ROOT  (user: $RUN_USER)"

# --- 1. Node 20 -------------------------------------------------------------
need_node=1
if [ -n "$NODE_BIN" ]; then
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$major" -ge 18 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
  log "installing Node 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs git
fi
NODE_BIN="$(command -v node)"
ok "node $(node -v) at $NODE_BIN"

# --- 2. .env.local ----------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  warn ".env.local created from the template — FILL IT, then re-run this script:"
  warn "    nano $ENV_FILE   # set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,"
  warn "                     #     SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD (minimum)"
  exit 0
fi
chmod 600 "$ENV_FILE"

# Required-for-build keys must be present (NEXT_PUBLIC_* are baked at build time).
get_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/\r$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//' ; }
for key in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY ADMIN_PASSWORD; do
  [ -z "$(get_env "$key")" ] && fail "$key is empty in .env.local — fill it and re-run."
done

# Auto-generate the deploy-webhook secret if blank (keeps `git push` auto-deploy ready).
ensure_env() { # key, value
  if grep -qE "^$1=" "$ENV_FILE"; then
    [ -z "$(get_env "$1")" ] && sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE" && warn "set $1 in .env.local"
  else
    printf '\n%s=%s\n' "$1" "$2" >> "$ENV_FILE"; warn "added $1 to .env.local"
  fi
}
ensure_env UPDATE_WEBHOOK_SECRET "$(openssl rand -hex 32)"
ensure_env DEPLOY_BRANCH "main"
ok ".env.local ready (chmod 600)"

# --- 3. Build ---------------------------------------------------------------
log "npm ci"; npm ci
log "npm run selfhost:build"; npm run selfhost:build
ok "build complete"

# --- 4. systemd services (templated to this user + path) --------------------
install_unit() { # source-name
  local src="$PROJECT_ROOT/deploy/selfhost/$1" dst="/etc/systemd/system/$1"
  sed -e "s|/home/YOUR_USER/tez-motors|$PROJECT_ROOT|g" \
      -e "s|YOUR_USER|$RUN_USER|g" \
      -e "s|/usr/bin/node|$NODE_BIN|g" \
      "$src" | sudo tee "$dst" >/dev/null
  ok "installed $dst"
}
log "installing systemd units"
install_unit tez-motors.service
install_unit tez-motors-webhook.service

# Passwordless restart for the webhook user (ONLY that one command).
SUDOERS=/etc/sudoers.d/tez-motors
echo "$RUN_USER ALL=(root) NOPASSWD: $SYSTEMCTL restart tez-motors" | sudo tee "$SUDOERS" >/dev/null
sudo chmod 440 "$SUDOERS"
sudo visudo -cf "$SUDOERS" >/dev/null && ok "sudoers: webhook can restart the app"

sudo "$SYSTEMCTL" daemon-reload
sudo "$SYSTEMCTL" enable --now tez-motors
sudo "$SYSTEMCTL" enable --now tez-motors-webhook
ok "services enabled + started"

# --- 5. Health check --------------------------------------------------------
log "health check (up to 30s)"
healthy=0
for _ in $(seq 1 30); do
  if curl -fsS -m 3 "http://localhost:3000/api/cars?limit=1" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 1
done
[ "$healthy" -eq 1 ] && ok "app is UP on http://localhost:3000" || fail "app didn't come up — check: journalctl -u tez-motors -n 80"

# --- Done: print the two human-only steps -----------------------------------
SECRET="$(get_env UPDATE_WEBHOOK_SECRET)"
cat <<EOF

===============================================================
 Tez Motors is running locally + auto-deploy is armed.
 Two manual steps remain (they need a human):

 1) PUBLIC HTTPS via Cloudflare Tunnel (once):
      cloudflared tunnel login
      cloudflared tunnel create tez-motors
      cloudflared tunnel route dns tez-motors tezmotors.uz
      cloudflared tunnel route dns tez-motors deploy.tezmotors.uz
    Put in ~/.cloudflared/config.yml (ingress, above http_status:404):
      - hostname: tezmotors.uz
        service: http://localhost:3000
      - hostname: deploy.tezmotors.uz
        service: http://localhost:9090
    Then:  sudo cloudflared service install && sudo systemctl restart cloudflared

 2) GITHUB → auto-deploy on push:
    GitHub repo → Settings → Webhooks → Add webhook
      Payload URL:   https://deploy.tezmotors.uz/webhook
      Content type:  application/json
      Secret:        $SECRET
      Events:        Just the push event
    After that, every \`git push\` to '$(get_env DEPLOY_BRANCH)' deploys live.

 Manual deploy any time:  ./deploy/selfhost/update.sh
 Roll back:               ./deploy/selfhost/rollback.sh
===============================================================
EOF
