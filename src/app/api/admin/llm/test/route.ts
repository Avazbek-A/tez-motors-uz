import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { llmConfigured, llmText, resolveProvider } from "@/lib/llm";

/**
 * Ping the configured LLM so the dealer can confirm setup (esp. a free local
 * Ollama) without digging through server logs. Admin-gated, fail-open: never
 * throws, returns a clear { ok, reason }.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  if (!llmConfigured()) {
    return NextResponse.json({ ok: false, reason: "not_configured", message: "No LLM configured. Set LLM_API_KEY (hosted) or LLM_PROVIDER=openai + LLM_API_URL (local Ollama)." });
  }

  const provider = resolveProvider();
  const model = process.env.LLM_MODEL || (provider === "openai" ? "qwen2.5:7b-instruct" : "claude-3-5-haiku-latest");
  const started = Date.now();
  const text = await llmText({ system: "You are a connectivity check. Reply with exactly: OK", user: "ping", maxTokens: 10 });
  const ms = Date.now() - started;

  if (text) {
    return NextResponse.json({ ok: true, provider, model, latencyMs: ms, sample: text.slice(0, 80) });
  }
  return NextResponse.json({
    ok: false,
    reason: "no_response",
    provider,
    model,
    latencyMs: ms,
    message: provider === "openai"
      ? "Configured but no reply — is Ollama running (ollama serve) and the model pulled? Is LLM_API_URL reachable from the app?"
      : "Configured but no reply — check LLM_API_KEY / LLM_API_URL and provider status.",
  });
}
