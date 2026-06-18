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

### Cost reality
The PBX software + hosting can be **$0**. Real **PSTN calls to/from UZ phone numbers cannot
be free** — a carrier charges per-minute + number rental. That carrier cost is the ONLY
irreducible spend, and it's pay-as-you-go (a few $), deferrable until you actually dial real
numbers. App-to-app / WebRTC calls (e.g. a website "call us" → rep's browser) are free.

1. **VPS** — public IPv4, Ubuntu 22.04, root SSH.
   - **FREE option: Oracle Cloud "Always Free"** — public-IP VM (up to 4 ARM cores / 24 GB),
     free forever, Gulf region (decent UZ latency). Runs Asterisk + coturn fine. Caveats:
     a card is required for identity verification (not charged); keep the instance active so
     Oracle doesn't reclaim idle Always-Free ARM VMs.
   - Paid alt (~$5–12/mo): Hetzner / Contabo / Vultr (EU/Turkey).
2. **UZ SIP trunk + DID (phone number)** — ONLY needed for real PSTN calls (skip for a
   free app-to-app/WebRTC-only setup). From a UZ provider (onlinepbx.uz as a *trunk*
   provider, a UZ telecom's business SIP, or a reseller). You need: SIP server host,
   registration user/pass, the DID, and the provider's signalling/media IP ranges (firewall
   allowlist). UZ numbers may require business docs. **Prefer pay-as-you-go + set a hard
   credit cap** — cheapest toll-fraud insurance.
3. **DNS** — `pbx.tezmotors.uz` → the VPS public IP (A record). Needed for the WebRTC TLS cert.

### Free vs paid, by what you want to do
- **AI on your real calls, $0, ALREADY WORKING:** record normal phone/Telegram calls (iOS
  native recorder) → `/api/admin/calls/upload-recording` → Whisper + analysis. No PBX needed.
- **Free PBX to build/experiment + app-to-app/WebRTC + AI-receptionist demo:** Oracle Always
  Free + Asterisk — no phone numbers, no carrier, $0.
- **Dial/receive real UZ phones from the app:** add the pay-as-you-go SIP trunk (the only spend).

Once the VPS exists + I have SSH, I configure everything below.

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
