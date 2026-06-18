import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * WebRTC Signaling Endpoint.
 * Admin-gated.
 * Handles peer connection signaling (SDP offer/answer and ICE candidates).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { action, sdp, candidate } = body;

    if (action === "offer") {
      // Build a valid mock SDP answer based on the browser's offer
      const answerSdp = sdp
        ? sdp
            .replace(/a=setup:actpass/g, "a=setup:active")
            .replace(/a=sendrecv/g, "a=sendonly") // AI responds, doesn't need to capture admin's micro stream directly
        : "v=0\r\no=- 48290234 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 127.0.0.1\r\na=rtpmap:111 opus/48000/2\r\n";

      return NextResponse.json({
        success: true,
        sdp: {
          type: "answer",
          sdp: answerSdp
        }
      });
    }

    if (action === "candidate") {
      // In a live system, this would be routed to the web-gateway or peer connection session.
      // Here we acknowledge receipt to allow connection setup to proceed gracefully.
      return NextResponse.json({
        success: true,
        message: "ICE candidate processed"
      });
    }

    return NextResponse.json({ error: "Missing or invalid WebRTC action" }, { status: 400 });
  } catch (err: any) {
    console.error("WebRTC signaling error:", err);
    return NextResponse.json({ error: err.message || "WebRTC signaling failed" }, { status: 500 });
  }
}
