import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { requireAdmin } from "@/lib/auth";

/**
 * WebRTC softphone (SIP.js) connection config for the logged-in admin.
 *
 * SECURITY: the SIP password must never ship in the public client bundle
 * (NEXT_PUBLIC_*), so the browser fetches it from THIS admin-gated endpoint after
 * login instead. Returns { configured:false } until the PBX env is set, so the UI
 * degrades gracefully before the VPS/Asterisk exists.
 *
 * Env (set in the Vostro app .env.local once the PBX is live):
 *   PBX_WS_URL            wss://pbx.tezmotors.uz:8089/ws
 *   SOFTPHONE_SIP_URI     sip:6001@pbx.tezmotors.uz
 *   SOFTPHONE_AUTH_USER   6001
 *   SOFTPHONE_PASSWORD    <the [6001-auth] password from pjsip_secrets.conf>
 *   SOFTPHONE_DISPLAY_NAME (optional)
 *   PBX_TURN_URL          turn:pbx.tezmotors.uz:3478   (optional, for restrictive NAT)
 *   PBX_TURN_SECRET       <coturn static-auth-secret>  (optional; pairs with PBX_TURN_URL)
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard) return guard;

  const wsServer = (process.env.PBX_WS_URL || "").trim();
  const sipUri = (process.env.SOFTPHONE_SIP_URI || "").trim();
  const authUser = (process.env.SOFTPHONE_AUTH_USER || "").trim();
  const password = (process.env.SOFTPHONE_PASSWORD || "").trim();

  if (!wsServer || !sipUri || !authUser || !password) {
    return NextResponse.json({ configured: false });
  }

  // ICE: public STUN always; ephemeral TURN credentials (coturn REST API, pairs
  // with `use-auth-secret` in turnserver.conf) when a TURN secret is configured.
  const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  const turnUrl = (process.env.PBX_TURN_URL || "").trim();
  const turnSecret = (process.env.PBX_TURN_SECRET || "").trim();
  if (turnUrl && turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:tez`; // valid ~1h
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
    iceServers.push({ urls: turnUrl, username, credential });
  }

  return NextResponse.json({
    configured: true,
    wsServer,
    sipUri,
    authUser,
    password,
    displayName: (process.env.SOFTPHONE_DISPLAY_NAME || "Tez Motors").trim(),
    iceServers,
  });
}
