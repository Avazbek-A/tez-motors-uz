# Tez Motors — Self-Hosted PBX (Asterisk/FreePBX) + AI Integration

Goal: **own** the telephony (make/receive real UZ calls, record, route) and feed every
call into the Tez Motors CRM + AI pipeline. Architected so the telephony layer (this
PBX, on a VPS) and the intelligence layer (CRM/AI on the Vostro) stay cleanly separated
by the webhook/upload seam — so the AI layer can be spun off into a product later.

```
[UZ SIP trunk] ─ SIP/RTP ─ [Asterisk/FreePBX on a public-IP VPS] ─ HTTPS upload ─► [Tez Motors CRM+AI on Vostro]
                                  │  WebRTC (WSS+coturn)
                              [admin PWA softphone — iPhone/Mac]
```

> ⚠️ **READ THE SECURITY SECTION FIRST.** An unhardened public Asterisk gets toll-fraud'd
> within hours — bots route thousands of dollars of premium-rate calls through it. The
> hardening below is **mandatory**, not optional.

---

## 0. What YOU must procure (cannot be automated)

1. **VPS** — public IPv4, ~2 vCPU / 2–4 GB RAM, Ubuntu 22.04. EU (Frankfurt) or Turkey for
   acceptable UZ latency. Hetzner / Contabo / Vultr (~$5–12/mo). Root SSH.
2. **UZ SIP trunk + DID (phone number)** — from a UZ provider (onlinepbx.uz as a trunk
   provider, a UZ telecom's business SIP, or a reseller). You need: SIP server host, your
   registration username/password, the DID number, and the provider's signalling/media IP
   ranges (for the firewall allowlist). UZ numbers may require business documents.
   **Set a hard spending/credit cap on the trunk** — the cheapest toll-fraud insurance.
3. **DNS** — `pbx.tezmotors.uz` → the VPS public IP (A record). Needed for the TLS cert
   that WebRTC (softphone) requires.

Once these exist + I have SSH, I configure everything below.

---

## 1. Base install (Ubuntu 22.04 VPS)

Use the official FreePBX 17 / Asterisk 20 install (sangoma script) or Debian package path.
Outline:
- `apt update && apt upgrade`; set hostname `pbx.tezmotors.uz`.
- Install Asterisk 20 LTS + FreePBX 17 (chan_pjsip enabled).
- `certbot` (Let's Encrypt) for `pbx.tezmotors.uz` → TLS for WSS + SRTP.

## 2. SECURITY HARDENING (do BEFORE connecting the trunk)

- **Firewall (ufw / nftables): default-deny inbound.** Allow only:
  - SSH (22) from YOUR IPs only.
  - SIP signalling (5060/5061) from the **trunk provider's IP ranges only** — never 0.0.0.0/0.
  - RTP UDP 10000–20000 from the trunk + TURN.
  - WSS 8089 + 443/80 (cert) for the WebRTC softphone.
- **fail2ban** with the Asterisk jail (bans SIP brute-force).
- **pjsip:** `allowguest=no`; no anonymous/default context that can dial out; endpoints use
  **long random secrets** (not extension numbers); `identify` trunk by IP.
- **Outbound dial-plan limits:** allow ONLY UZ + the specific destinations you call. Block
  premium/international ranges by default. This caps fraud damage even if creds leak.
- **Trunk-side credit cap** (set with the provider) — the final backstop.
- TLS + SRTP for the softphone leg; disable plain UDP for WebRTC.
- Change all default passwords; restrict the FreePBX admin GUI to your IPs / behind auth.

## 3. Trunk + routes
- Create a `chan_pjsip` trunk: register to the provider, identify by their IP.
- Inbound route: DID → ring the softphone extension (later: → AI receptionist).
- Outbound route: your extension → trunk, with the dial-pattern allowlist from §2.

## 4. WebRTC softphone (in the admin PWA)
- Asterisk: a `webrtc=yes` pjsip endpoint over WSS (8089) with the Let's Encrypt cert.
- **coturn** (TURN) on the VPS for NAT media traversal (browser ↔ Asterisk).
- App: a SIP.js client in the admin app registers to `wss://pbx.tezmotors.uz:8089/ws`,
  creds + server from env. Lets you call/receive in-browser on iPhone/Mac.

## 5. Post-call AI (reuses what's already built — the big win)
Asterisk records every call and uploads it to the existing pipeline; no new AI code.
- FreePBX: enable call recording (MixMonitor) for inbound + outbound.
- Hangup hook (Asterisk `h` extension / `hangup_handler` / a small post-record script):
  `curl -s -X POST https://tezmotors.uz/api/admin/calls/upload-recording \
        -H "Authorization: Bearer $CALLS_UPLOAD_SECRET" \
        -F "audio=@<recording>.wav;type=audio/wav" \
        -F "caller_phone=<CALLERID>" -F "direction=<inbound|outbound>" \
        -F "duration_sec=<DURATION>"`
- → the recording is transcribed (self-hosted Whisper on the Vostro), AI-analyzed,
  lead-scored, and linked to the customer in the CRM. **Already working.**

## 6. Real-time AI (Phase 4 — the payoff of owning the media)
- **AI receptionist:** inbound call → Asterisk `AudioSocket`/external-media streams audio
  to a bridge service → streaming STT (Whisper) + LLM intent → TTS reply → dynamic routing
  (no keypad IVR). The LLM decides "sales vs service vs parts" and routes/answers.
- **Live coaching:** stream the active call to the bridge → real-time sentiment + the
  buy-price brain → push hints to the rep's softphone.
These need owned media (why we self-host) and build on the bridge above.

---

## Phasing
1. **Real calls** — VPS + trunk + hardening + a softphone extension. (Procure → config.)
2. **Auto-record → CRM/AI** — §5 hook into the built pipeline. Every call analyzed.
3. **In-app WebRTC softphone** — §4, calls inside the admin PWA on your phone.
4. **Real-time AI receptionist + live coaching** — §6.

## Spin-off note
The PBX (VPS) and the CRM/AI (Vostro) talk only over the HTTPS seam (§5 upload + the
sip-webhook events). To productize later: the AI/CRM layer goes multi-tenant; each customer
brings/rents their own trunk + PBX instance; the seam contract stays identical.
