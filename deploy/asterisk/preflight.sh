#!/usr/bin/env bash
#==============================================================================
# Tez Motors — PBX pre-flight / health check. Run on the VPS after bootstrap.sh
# + apply.sh (and again after the Uztelecom creds are in). Read-only diagnostics:
# it changes nothing, just tells you what's ready and what isn't.
#   bash preflight.sh
#==============================================================================
set -uo pipefail
PBX_DOMAIN="${PBX_DOMAIN:-pbx.tezmotors.uz}"
ok(){ printf "  \033[32mOK\033[0m   %s\n" "$1"; }
no(){ printf "  \033[31mFAIL\033[0m %s\n" "$1"; }
hm(){ printf "  \033[33m??\033[0m   %s\n" "$1"; }

echo "== Tez Motors PBX pre-flight =="

# 1) DNS → does the domain point at THIS box's public IP?
pubip="$(curl -s --max-time 8 https://api.ipify.org || true)"
dnsip="$(getent hosts "$PBX_DOMAIN" | awk '{print $1}' | head -1)"
[ -n "$pubip" ] && echo "  this VPS public IP: $pubip"
if [ -z "$dnsip" ]; then no "DNS: $PBX_DOMAIN does not resolve (add the A record)"
elif [ "$dnsip" = "$pubip" ]; then ok "DNS: $PBX_DOMAIN → $dnsip (matches this box)"
else hm "DNS: $PBX_DOMAIN → $dnsip (this box is $pubip — ok if 1:1 NAT/Oracle)"; fi

# 2) TLS cert for the WebRTC leg
if [ -f "/etc/asterisk/keys/fullchain.pem" ]; then ok "TLS cert present (/etc/asterisk/keys)"
else no "TLS cert missing — run certbot (bootstrap step 5) once DNS is live"; fi

# 3) Asterisk up + the config seams
if asterisk -rx "core show version" >/dev/null 2>&1; then ok "Asterisk responding to CLI"
else no "Asterisk not running (systemctl status asterisk)"; fi
asterisk -rx "pjsip show endpoints" 2>/dev/null | grep -q "uztelecom" && ok "endpoint 'uztelecom' loaded" || no "endpoint 'uztelecom' not loaded (apply.sh + pjsip_secrets.conf?)"
asterisk -rx "pjsip show endpoints" 2>/dev/null | grep -q "6001"      && ok "softphone endpoint '6001' loaded" || hm "softphone '6001' not loaded (ok if not using the in-app softphone yet)"

# 4) Trunk registration / identify (depends on the creds being filled)
reg="$(asterisk -rx "pjsip show registrations" 2>/dev/null)"
if echo "$reg" | grep -qi "Registered"; then ok "trunk REGISTERED with Uztelecom"
elif echo "$reg" | grep -qiE "Rejected|Auth"; then no "trunk registration REJECTED — check user/pass in pjsip_secrets.conf"
else hm "no registration yet (fine for pure IP-auth trunks — check 'pjsip show identifies')"; fi

# 5) The recording→CRM seam (must be reachable from the VPS; 401 = reachable+gated)
url="$(. /etc/asterisk/tez.env 2>/dev/null; echo "${CALLS_UPLOAD_URL:-https://tezmotors.uz/api/admin/calls/upload-recording}")"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$url" || echo ERR)"
[ "$code" = "401" ] && ok "CRM upload endpoint reachable + gated (401 without token)" || hm "CRM upload endpoint returned $code (expected 401)"
grep -q "^CALLS_UPLOAD_SECRET=..*" /etc/asterisk/tez.env 2>/dev/null && ok "CALLS_UPLOAD_SECRET is set in /etc/asterisk/tez.env" || no "CALLS_UPLOAD_SECRET missing in /etc/asterisk/tez.env (recordings won't upload)"

# 6) Listening services + firewall
ss -lun 2>/dev/null | grep -q ":5060" && ok "SIP/UDP 5060 listening" || hm "nothing on UDP 5060 yet"
ss -ltn 2>/dev/null | grep -q ":8089" && ok "WSS 8089 listening (softphone)" || hm "nothing on TCP 8089 (softphone WSS)"
systemctl is-active --quiet coturn && ok "coturn active" || hm "coturn not active (only needed for the softphone)"
systemctl is-active --quiet fail2ban && ok "fail2ban active" || hm "fail2ban not active"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw status 2>/dev/null | grep -q "5060" && ok "ufw active + a 5060 rule exists" || no "ufw active but NO 5060 rule (trunk can't reach you)"
else no "ufw inactive — firewall hardening not applied"; fi

echo "== done =="
