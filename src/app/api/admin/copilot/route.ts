import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { runCopilotTurn } from "@/lib/copilot/core";

/**
 * Dealer Copilot — web endpoint (Phase AE). Admin-gated. Runs one conversational
 * turn: reads answer questions; writes propose a confirm-gated action that only
 * executes when the dealer confirms (`confirm: true` from the Confirm button, or
 * a "yes" message). Fail-open — runCopilotTurn never throws.
 */
const schema = z.object({
  message: z.string().min(1).max(1000),
  threadId: z.string().min(1).max(80).optional(),
  confirm: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const supabase = createServiceClient();
  const threadId = parsed.data.threadId || "web";
  const turn = await runCopilotTurn({
    supabase,
    threadId,
    message: parsed.data.message,
    confirm: parsed.data.confirm,
  });
  return NextResponse.json(turn);
}
