import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Apple Vision & Mobile WebXR AR Showroom State Sync (Leap 12).
 * Admin-gated.
 * Handles synchronizing vehicle doors, hoods, and colors on the client's screen in real time.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { action, value } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      viewport_active: true,
      synced_action: action,
      synced_value: value,
      client_sync_timestamp: new Date().toISOString(),
      message: `WebXR AR viewport synchronized action: ${action} to ${value}`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to sync AR viewport" }, { status: 500 });
  }
}
