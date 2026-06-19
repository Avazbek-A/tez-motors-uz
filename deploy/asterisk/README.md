# Tez Motors — Asterisk PBX (config-as-code)

Raw Asterisk 20 on a **public-IP VPS** (the Vostro can't host it — it's behind a
residential router + Cloudflare WARP with no inbound reachability; verified). The
PBX talks to the CRM/AI on the Vostro only over the HTTPS upload seam. See
`../selfhost/PBX-SETUP.md` for the architecture + phasing.

```
[Uztelecom SIP trunk] ─SIP/RTP─ [Asterisk @ VPS] ─HTTPS upload─► [Tez Motors CRM+AI @ Vostro]
                                      │ WSS+coturn
                                  [admin PWA softphone]
```

## Files
| file | what |
|------|------|
| `pjsip.conf` | transports, Uztelecom trunk (reg + IP-auth), WebRTC softphone `6001` |
| `pjsip_secrets.conf.example` | → `pjsip_secrets.conf` (gitignored): trunk creds, DID, provider IPs, softphone pw |
| `extensions.conf` | dialplan — inbound→rep, **outbound UZ-only allowlist (toll-fraud)**, auto-record |
| `scripts/upload-recording.sh` | MixMonitor hangup hook → `POST /api/admin/calls/upload-recording` |
| `rtp.conf` / `http.conf` | RTP range + WSS(8089) TLS for WebRTC |
| `coturn/turnserver.conf` | TURN relay for browser media |
| `tez.env.example` | → `/etc/asterisk/tez.env`: `CALLS_UPLOAD_SECRET` (match the Vostro) |
| `bootstrap.sh` | one-time VPS setup: install + firewall + fail2ban + certbot + coturn |
| `apply.sh` | sync configs → `/etc/asterisk` + reload (re-run on every change) |

## Go-live (once the VPS + Uztelecom creds exist)
```bash
# On the VPS (Ubuntu 22.04, as root). DNS: pbx.tezmotors.uz → VPS IP first (for the cert).
git clone <repo> && cd <repo>/deploy/asterisk
PBX_DOMAIN=pbx.tezmotors.uz ADMIN_SSH_CIDR=<your.ip>/32 \
  PROVIDER_SIP_IPS="<uztelecom_ip_1>,<uztelecom_ip_2>" bash bootstrap.sh

# Fill the two secret files the bootstrap/apply seeded:
#   /etc/asterisk/pjsip_secrets.conf   ← Uztelecom host/user/pass/DID/IPs
#   /etc/asterisk/tez.env              ← CALLS_UPLOAD_SECRET (same as Vostro .env.local)
bash apply.sh

asterisk -rx 'pjsip show registrations'   # → Registered
asterisk -rx 'pjsip show endpoints'       # → uztelecom + 6001 (Avail)
```
**Don't have the provider IPs yet?** Run `bootstrap.sh` with `SKIP_FIREWALL=1` to
install only, then re-run the firewall step once the Uztelecom welcome email lands.

> On Oracle/Hetzner the **cloud firewall** must open the same ports as ufw
> (22, 5060-5061, 10000-20000/udp, 8089, 80/443, 3478, 49152-65535/udp).

## In-app softphone (phase 3) — env on the Vostro app
The browser softphone (`/admin/calls/softphone`) is already built; it stays inert until
these are set in the **Vostro app** `.env.local` (then restart the app). The browser
connects straight to the VPS Asterisk over WSS, so DNS + the TLS cert must be live first.
```
PBX_WS_URL=wss://pbx.tezmotors.uz:8089/ws
SOFTPHONE_SIP_URI=sip:6001@pbx.tezmotors.uz
SOFTPHONE_AUTH_USER=6001
SOFTPHONE_PASSWORD=<same value as [6001-auth] in pjsip_secrets.conf>
# optional, for restrictive client NAT (pairs with coturn use-auth-secret):
PBX_TURN_URL=turn:pbx.tezmotors.uz:3478
PBX_TURN_SECRET=<same as static-auth-secret in turnserver.conf>
```
The SIP password is served only to a logged-in admin via `/api/admin/calls/softphone-config`
— never baked into the public bundle.

## What I need from the owner (the only blockers)
1. A public-IP VPS + SSH (Oracle Cloud **Always-Free** = $0; or any paid VPS).
2. Uztelecom: SIP host, username/password (or IP-auth), the DID, and their signalling IP range(s).
3. DNS A record `pbx.tezmotors.uz → VPS IP` (needed for the WebRTC TLS cert; not for the trunk itself).
