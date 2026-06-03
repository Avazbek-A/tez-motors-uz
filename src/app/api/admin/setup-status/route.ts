import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { INTEGRATIONS, buildSetupStatus } from "@/lib/setup-status";
import { llmConfigured } from "@/lib/llm";

/**
 * Read-only integration status for the Setup page. Returns ONLY booleans
 * (whether each env var is set) — never the secret values. Admin-gated.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const present: Record<string, boolean> = {};
  for (const def of INTEGRATIONS) {
    for (const v of def.envVars) {
      present[v] = typeof process.env[v] === "string" && process.env[v]!.trim().length > 0;
    }
  }

  // LLM is enabled by a hosted key OR a local Ollama URL (no key) — use the
  // wrapper's own logic so the Setup page matches what actually runs.
  return NextResponse.json(buildSetupStatus(present, { llm: llmConfigured() }));
}
