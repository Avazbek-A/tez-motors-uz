import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminSessionContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { runCopilotTurn } from "@/lib/copilot/core";

/**
 * Dealer Copilot — web endpoint (Phase AE). Admin-gated. Runs one conversational
 * turn: reads answer questions; writes propose a confirm-gated action that only
 * executes when the dealer confirms (`confirm: true` from the Confirm button, or
 * a "yes" message). Fail-open — runCopilotTurn never throws.
 *
 * SECURITY: the effective thread_id is namespaced with the SERVER-resolved admin
 * id (not the client-supplied value). Without that prefix two admins could share
 * the default thread "web" — or one admin could submit another admin's known
 * threadId — and confirm each other's pending writes (a markdown_car / advance_
 * order could be triggered by the wrong actor saying "да"). Per-admin namespace
 * scopes every pending row to the user that proposed it.
 */
const schema = z.object({
  message: z.string().min(1).max(1000),
  // Loose-shape client thread (a per-tab random suffix from localStorage). The
  // server prepends the admin id, so a malicious client passing an attacker
  // threadId can only collide within its own actor namespace.
  threadId: z.string().min(1).max(80).regex(/^[\w-]+$/).optional(),
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

  // Resolve the calling admin so the pending-action scope is per-actor.
  // Fall back to the session token hash if there's no admin_user row (bootstrap
  // master-password path) — that's still per-session, never shared.
  const ctx = await getAdminSessionContext(request);
  const actorKey = ctx?.user?.id || `s:${ctx?.session?.token_hash?.slice(0, 16) ?? "anon"}`;
  const clientThread = parsed.data.threadId || "web";
  const threadId = `${actorKey}:${clientThread}`;

  const supabase = createServiceClient();
  const turn = await runCopilotTurn({
    supabase,
    threadId,
    message: parsed.data.message,
    confirm: parsed.data.confirm,
  });
  return NextResponse.json(turn);
}
