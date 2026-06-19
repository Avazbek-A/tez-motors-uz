#!/usr/bin/env bash
#==============================================================================
# Tez Motors — one-time VPS bootstrap for the Asterisk PBX (Ubuntu 22.04).
# Installs Asterisk 20 + coturn + fail2ban + certbot and applies the MANDATORY
# toll-fraud hardening (default-deny firewall locked to YOUR + the provider's IPs).
#
# Run as root on the FRESH VPS, with the required vars set:
#   PBX_DOMAIN=pbx.tezmotors.uz \
#   ADMIN_SSH_CIDR=<your.ip.addr.0/24> \
#   PROVIDER_SIP_IPS="<uztelecom_ip_1>,<uztelecom_ip_2>" \
#   bash bootstrap.sh
#
# It REFUSES to open SIP to 0.0.0.0/0 — you MUST supply the provider IP(s) from
# the Uztelecom welcome email. (Don't have them yet? Run with SKIP_FIREWALL=1 to
# install only, then re-run the firewall block once the IPs arrive.)
#
# NOTE: a cloud VPS (Oracle/Hetzner/…) ALSO has its own cloud firewall / security
# list — you must open the SAME ports there (22, 5060-5061, 10000-20000/udp,
# 8089, 80, 443, 3478, 49152-65535/udp). ufw alone is not enough on Oracle.
#==============================================================================
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "run as root"; exit 1; }
: "${PBX_DOMAIN:?set PBX_DOMAIN=pbx.tezmotors.uz}"

echo "==> [1/6] packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y asterisk coturn fail2ban ufw certbot curl ca-certificates
hostnamectl set-hostname "$PBX_DOMAIN" || true

echo "==> [2/6] dirs + perms"
install -d -o asterisk -g asterisk /var/spool/asterisk/monitor /etc/asterisk/keys /etc/asterisk/scripts
touch /var/log/asterisk/tez-upload.log && chown asterisk:asterisk /var/log/asterisk/tez-upload.log

echo "==> [3/6] firewall (default-deny inbound)"
if [ "${SKIP_FIREWALL:-0}" = "1" ]; then
  echo "    SKIP_FIREWALL=1 → not touching ufw (re-run later with PROVIDER_SIP_IPS set)"
else
  : "${ADMIN_SSH_CIDR:?set ADMIN_SSH_CIDR=<your.ip>/32 so you do not lock yourself out}"
  : "${PROVIDER_SIP_IPS:?set PROVIDER_SIP_IPS=comma,separated,uztelecom,ips — refusing to open SIP to the world}"
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow from "$ADMIN_SSH_CIDR" to any port 22 proto tcp
  IFS=',' read -ra SIPS <<< "$PROVIDER_SIP_IPS"
  for ip in "${SIPS[@]}"; do
    ip="$(echo "$ip" | xargs)"; [ -z "$ip" ] && continue
    ufw allow from "$ip" to any port 5060 proto udp
    ufw allow from "$ip" to any port 5061 proto tcp
  done
  # RTP media + WebRTC + TURN + cert HTTP. RTP/TURN source IPs vary, so the range
  # is open but bounded; the dialplan allowlist is the real fraud backstop.
  ufw allow 10000:20000/udp        # RTP
  ufw allow 8089/tcp               # WebRTC WSS (softphone)
  ufw allow 80/tcp                 # certbot http-01
  ufw allow 443/tcp                # (optional) https
  ufw allow 3478                   # STUN/TURN
  ufw allow 49152:65535/udp        # coturn relay range
  ufw --force enable
  ufw status verbose
fi

echo "==> [4/6] fail2ban (asterisk SIP brute-force jail)"
cat > /etc/fail2ban/jail.d/asterisk.local <<'EOF'
[asterisk]
enabled  = true
filter   = asterisk
logpath  = /var/log/asterisk/messages
maxretry = 5
findtime = 600
bantime  = 86400
EOF
systemctl enable --now fail2ban || true

echo "==> [5/6] TLS cert for $PBX_DOMAIN (LetsEncrypt, standalone http-01)"
if [ ! -f "/etc/letsencrypt/live/$PBX_DOMAIN/fullchain.pem" ]; then
  systemctl stop asterisk || true
  certbot certonly --standalone -d "$PBX_DOMAIN" --register-unsafely-without-email --agree-tos -n || \
    echo "    (cert failed — ensure DNS A record $PBX_DOMAIN → this VPS, then re-run)"
fi
# Deploy hook: copy renewed certs where Asterisk reads them + reload.
cat > /etc/letsencrypt/renewal-hooks/deploy/asterisk-cert.sh <<EOF
#!/usr/bin/env bash
cp -f /etc/letsencrypt/live/$PBX_DOMAIN/fullchain.pem /etc/asterisk/keys/fullchain.pem
cp -f /etc/letsencrypt/live/$PBX_DOMAIN/privkey.pem  /etc/asterisk/keys/privkey.pem
chown asterisk:asterisk /etc/asterisk/keys/*.pem
asterisk -rx "module reload res_http_websocket.so" >/dev/null 2>&1 || true
asterisk -rx "core reload" >/dev/null 2>&1 || true
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/asterisk-cert.sh
[ -f "/etc/letsencrypt/live/$PBX_DOMAIN/fullchain.pem" ] && /etc/letsencrypt/renewal-hooks/deploy/asterisk-cert.sh || true

echo "==> [6/6] coturn"
sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
systemctl enable coturn || true

echo
echo "Bootstrap done. NEXT:"
echo "  1) Put CALLS_UPLOAD_SECRET into /etc/asterisk/tez.env (see tez.env.example)."
echo "  2) Fill pjsip_secrets.conf from the Uztelecom welcome email."
echo "  3) Run ./apply.sh to sync configs + reload Asterisk."
echo "  4) If on Oracle/Hetzner: open the SAME ports in the CLOUD firewall too."
