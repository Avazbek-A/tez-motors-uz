# PBX Implementation Plan — for the implementing agent (Gemini)

**You are implementing a self-hosted Asterisk PBX that connects a real Uzbek SIP
trunk to the existing Tez Motors CRM + AI pipeline.** This doc is self-contained —
do not assume any prior chat context. Read it fully before touching anything.

Companion reference: **`deploy/selfhost/PBX-SETUP.md`** (the runbook — VPS spec,
provider list, config details). This file is the *execution plan + guardrails*.

---

## 0. The goal, the architecture, and the decisions already made (do NOT relitigate)

Goal: the dealer makes/receives real phone calls; every call is recorded, transcribed,
AI-analyzed, lead-scored, and linked to the customer in the CRM. Later: an AI
receptionist that answers + routes live.

**Locked decisions (do not change without the owner's say-so):**
1. **Raw Asterisk 20 LTS, config-as-code — NOT FreePBX.** FreePBX is a heavy
   Apache/PHP/MySQL GUI that adds no AI and bypasses for AI work. Keep all Asterisk
   config as plain text files in the repo under **`deploy/asterisk/`**, rsync'd to
   `/etc/asterisk/` on the server. Reproducible, version-controlled.
2. **Two layers, one seam.** TELEPHONY (Asterisk) and INTELLIGENCE (the Next.js
   CRM/AI on the Vostro) stay separate, joined ONLY by HTTP. Never weld them.
3. **Registration-based SIP trunking** (Asterisk registers to the provider like a
   softphone). No public inbound ports required → smaller attack surface + works
   behind NAT/CGNAT. (Confirmed working for Sarkor; see §4.)
4. **The AI pipeline ALREADY EXISTS — DO NOT REBUILD IT.** See §2.

```
[UZ SIP trunk] ─SIP/RTP─ [Asterisk] ─HTTP POST recording─► [Tez Motors CRM+AI]
                            │ WebRTC (later)                  (Whisper + analyze + CRM)
                        [softphone in admin PWA]
```

---

## 1. PRE-FLIGHT — confirm ALL of these before starting (block if any is missing)

Resolve these open variables with the owner first; the plan branches on them:

- [ ] **SIP trunk credentials in hand** — provider name, SIP server host, registration
      username, password, the DID (phone number), and the provider's
      signalling/media IP ranges. Confirm the trunk is **registration-based** and
      **works behind NAT** (ask the provider: "registration or dedicated-line/VLAN?
      static IP needed or NAT-OK? do you do media relay/anchoring?").
- [ ] **Where Asterisk runs** (decide — see §3):
      - **Vostro** (residential GPON, behind CGNAT) — free, fine for registration
        trunk + local calls + recording→AI. Limited remote WebRTC (TURN/CGNAT).
      - **UZ data-center server** (e.g. dc.uz / a UZ VPS with a public IP) — better:
        public IP, reliable, satisfies Uztelecom's "server-in-UZ" rule, enables remote
        WebRTC. Costs money.
- [ ] **`CALLS_UPLOAD_SECRET`** is set in the Vostro app's `.env.local` (it already is,
      per the recording feature). You'll reuse it for the Asterisk→CRM upload.
- [ ] **Outbound scope** confirmed with the owner: which destinations are allowed
      (UZ-local only? national? NO international by default). This gates §5 security.
- [ ] **A trunk credit/spend cap is set with the provider** (toll-fraud backstop).

If the trunk is **dedicated-line/VLAN only** (some Uztelecom configs), STOP and tell
the owner — that needs their physical line, not a registration config; consider a
registration-based provider (Sarkor / Zadarma) instead.

---

## 2. The existing AI pipeline — REUSE, do not rebuild

These already work and are deployed. Asterisk's only job is to **record a call and
POST the audio** to the existing endpoint; everything downstream is done.

- **Upload endpoint:** `POST /api/admin/calls/upload-recording`
  (`src/app/api/admin/calls/upload-recording/route.ts`).
  - Auth: `Authorization: Bearer <CALLS_UPLOAD_SECRET>` (server-to-server; reliable —
    unlike the flaky iPhone path).
  - Accepts multipart `{audio, transcript?, caller_phone, direction, duration_sec}`
    OR a raw audio body with `?caller_phone=&direction=`.
  - Pipeline (`src/lib/call-recording.ts` → `logRecording`): stores audio privately →
    transcribes via self-hosted Whisper (`WHISPER_URL=http://127.0.0.1:8089`, faster-
    whisper "medium" on the Vostro) → `analyzeCall` (summary, lead score, sentiment) →
    inserts a `calls` row → links/creates the CRM inquiry by phone. Responds <1s; the
    transcription/analysis runs in the background (`enrichRecording`).
- **Review UI:** `/admin/calls/recordings` (list + `AudioPlayer` + transcript +
  re-analyze button). Recordings served admin-gated via
  `/api/admin/calls/recording/[file]` (HTTP Range supported).

**If Asterisk runs ON the Vostro**, it can POST to the LOCAL app at
`http://127.0.0.1:3000/api/admin/calls/upload-recording` (no tunnel, fastest/most
reliable). **If on a separate server**, POST to `https://tezmotors.uz/...`.

⇒ **Do NOT write any new transcription/analysis/CRM code.** Just record + curl.

---

## 3. Phase 0 — server prep

1. Pick the host per §1. Install **Asterisk 20 LTS** with `chan_pjsip` (`apt install
   asterisk` on Ubuntu 22.04, or the official build). **No FreePBX.**
   - On the Vostro there is **NO passwordless sudo** and the app is managed without
     systemd in places; if installing Asterisk needs root and sudo prompts, surface to
     the owner — they may need to run the apt/systemd steps, or you use a UZ DC server
     where you have root.
2. Create `deploy/asterisk/` in the repo for: `pjsip.conf`, `extensions.conf`,
   `rtp.conf`, plus any `acl`/`security` includes. These are the source of truth;
   rsync to `/etc/asterisk/` and `asterisk -rx "core reload"` to apply.
3. Let's Encrypt cert for the PBX hostname (needed in §6 for WebRTC). Skip if Phase 1
   only uses a desk phone / same-LAN softphone.

---

## 4. Phase 1 — SIP trunk + first real call (THE tomorrow goal)

Provider-specific trunk config (from verified UZ templates — see
`deploy/selfhost/PBX-SETUP.md` + ex.uz/2021/09/sip-settings-uzbekistan/):

- **Sarkor** (recommended; registration-based, NAT-friendly): server `sip.uz:5060`,
  `nat=auto_force_rport,auto_comedia`, works behind NAT without port-forwarding.
  NOTE: no Early Media → set **Force Answer** on inbound routes. **No international
  outbound** (fine for local). This is the user's likely provider.
- **Uztelecom:** registration, but routed/dedicated transport, multiple subnets,
  number-format quirks — hardest. International allowed; server must be in UZ.
- **Zadarma** (easy/experiment): registration, international, instant signup — good for
  a same-day proof-of-concept before the local trunk contract.

Steps:
1. `pjsip.conf`: a registration + an endpoint/aor/auth/identify for the trunk (identify
   by the provider's IPs). One extension (the dealer's softphone/desk phone) with a
   **long random secret**.
2. `extensions.conf`: inbound route (DID → ring the extension; Force Answer for Sarkor)
   and an outbound route to the trunk **restricted to the allowed dial patterns only**
   (see §5 — do this BEFORE enabling outbound).
3. Register a softphone (e.g. Zoiper/Linphone on the dealer's phone, or a desk phone)
   to the extension over the LAN; **make + receive one real test call.** ✅ Phase-1 done.

---

## 5. SECURITY HARDENING — MANDATORY GATE (do this before enabling outbound)

A public/registered Asterisk gets toll-fraud'd fast — fraudulent premium-rate intl
calls, $thousands overnight. **All of the following must be true before the trunk dials
out. Treat as a hard gate.**

- [ ] **Registration-based only — NO open inbound SIP ports** (firewall: deny inbound
      5060/RTP from the internet; the trunk works via the outbound-registered path).
- [ ] **`allowguest=no`**, no anonymous/default context that can reach the outbound
      route. Every endpoint has a **long random secret** (never the extension number).
- [ ] **Outbound dial-plan allowlist**: permit ONLY the owner-approved destinations
      (UZ-local/national). Explicitly block international + premium ranges. A leaked
      credential then can't dial expensive numbers.
- [ ] **fail2ban** with the Asterisk/pjsip jail (ban SIP brute-force).
- [ ] **`ufw`/nftables default-deny**; SSH from owner IPs only.
- [ ] **Trunk-side credit cap** confirmed with the provider (final backstop).
- [ ] TLS/SRTP for the WebRTC leg (§6); no plain-UDP WebRTC.

Document in the PR exactly how each box is satisfied. Do NOT skip any.

---

## 6. Phase 2 — auto-record → CRM/AI (reuses §2; small)

1. Enable `MixMonitor` recording in `extensions.conf` for inbound + outbound calls
   (write to a temp dir).
2. On hangup (Asterisk `h` extension / `hangup_handler` / a post-record shell script),
   upload the recording to the existing endpoint:
   ```bash
   curl -s -X POST "$UPLOAD_URL/api/admin/calls/upload-recording" \
     -H "Authorization: Bearer $CALLS_UPLOAD_SECRET" \
     -F "audio=@${MONITOR_FILE};type=audio/wav" \
     -F "caller_phone=${CALLERID_NUM}" \
     -F "direction=${DIRECTION}" \
     -F "duration_sec=${ANSWEREDTIME}"
   ```
   `UPLOAD_URL` = `http://127.0.0.1:3000` if Asterisk is on the Vostro, else
   `https://tezmotors.uz`. Keep `CALLS_UPLOAD_SECRET` out of the repo (read from env).
3. Verify: place a test call → within ~1 min it appears at `/admin/calls/recordings`
   with a transcript + summary + correct customer link. ✅

---

## 7. Phase 3 — WebRTC softphone in the admin PWA

So the dealer calls/receives inside the existing admin app on iPhone/Mac.
- Asterisk: a `webrtc=yes` pjsip endpoint over WSS (8089) with the Let's Encrypt cert;
  **coturn** (TURN) on the server for NAT media traversal.
- App: a **SIP.js** client in the admin app registering to `wss://<pbx-host>:8089/ws`,
  server + creds from env. Add a dial pad + incoming-call UI.
- ⚠️ Topology: remote WebRTC media needs a reachable TURN. On the **Vostro behind
  CGNAT this is hard** → Phase 3 strongly favors a **public-IP UZ DC server**. If
  staying on the Vostro, scope Phase 3 to same-network use or defer it.

---

## 8. Phase 4 — real-time AI receptionist (later; the payoff of owning the media)

- Inbound call → Asterisk **AudioSocket** (or ARI external-media) streams raw audio to
  a small bridge service → streaming STT (Whisper) + an LLM (reuse the app's LLM
  routing in `src/lib/llm.ts`) for intent → TTS reply → dynamic routing (no keypad IVR).
- Live coaching: stream the active call to the bridge → sentiment + the buy-price brain
  → push hints to the rep's softphone.
- Build only after Phases 1–3 are solid. Keep the bridge as a separate service (seam).

---

## 9. What NOT to do (guardrails)

- ❌ Do not rebuild transcription/analysis/CRM — reuse `/api/admin/calls/upload-recording`.
- ❌ Do not install FreePBX or any web PBX GUI (attack surface; not config-as-code).
- ❌ Do not enable outbound dialing before §5 is fully satisfied + a credit cap is set.
- ❌ Do not allow anonymous/guest SIP or open inbound SIP to the internet.
- ❌ Do not commit `CALLS_UPLOAD_SECRET`, SIP passwords, or certs to the repo.
- ❌ Do not change the locked architecture decisions (§0) without owner approval.
- ❌ Do not allow international/premium dial patterns unless the owner explicitly asks.

## 10. Acceptance criteria

- Phase 1: a real inbound AND outbound call works through the trunk; §5 gate fully met.
- Phase 2: a test call appears in `/admin/calls/recordings` with transcript + summary +
  customer link, within ~1 min, with no new analysis code added.
- Each phase: `npx tsc --noEmit` clean, `npm run build` OK, tests green; document the
  §5 security checklist status in the PR.

## 11. References
- `deploy/selfhost/PBX-SETUP.md` — runbook (provider list, VPS spec, security detail).
- `src/lib/call-recording.ts`, `src/app/api/admin/calls/upload-recording/route.ts`,
  `/admin/calls/recordings` — the existing pipeline to feed.
- `deploy/selfhost/whisper-server.py` + `WHISPER_URL` — the STT service.
- UZ SIP configs: https://ex.uz/2021/09/sip-settings-uzbekistan/
