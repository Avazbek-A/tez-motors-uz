import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { fetchGlobalAutohomeSpec, parseVisionSpec, isAutohomeGlobalUrl, isAutohomeCnConfigUrl, type SpecData } from "@/lib/autohome-spec";
import { llmVision } from "@/lib/llm";

const VISION_SYSTEM = [
  "You read screenshots of a Chinese car CONFIGURATION/parameter table from AutoHome (汽车之家).",
  "The table has parameter rows and one column per trim/version (车型). Extract EVERYTHING.",
  "Translate parameter names and textual values to English; keep numbers and units exactly (e.g. 4775mm, 1.5L, 145kW).",
  "Use the section headers (基本参数/车身/发动机/…) as group names (translated: Basic, Body, Engine, …).",
  "A filled dot ● / 标配 = 'Standard'; ○ / 选装 = 'Optional'; blank/'-' = leave empty.",
  'Output STRICT JSON only, no commentary: {"brand":"","model":"","trims":[{"name":"","price":"","params":{"GroupName":{"ParamName":"value"}}}]}',
].join(" ");

async function captureCnSpec(url: string): Promise<{ screenshots: string[]; images: string[] } | null> {
  const base = process.env.EXTRACTOR_URL;
  if (!base) return null;
  try {
    const secret = process.env.EXTRACTOR_SECRET;
    const res = await fetch(`${base.replace(/\/$/, "")}/spec`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(70_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as { screenshots: string[]; images: string[] };
  } catch {
    return null;
  }
}

/**
 * Import a full multi-trim parameter configuration from an AutoHome model page
 * into cars.spec_data. Admin-gated, fail-open.
 *
 *  - global.autohome.com/.../config/spec/{id}  → clean JSON (this route, no browser)
 *  - car.autohome.com.cn/config/...            → obfuscated; needs the Vostro
 *    Playwright + vision extractor (Phase AD-2). Returns cn_needs_extractor until wired.
 */
const schema = z.object({ url: z.string().url().max(2000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "A valid AutoHome URL is required" }, { status: 400 });
  const url = parsed.data.url;

  let spec: SpecData | null = null;
  if (isAutohomeGlobalUrl(url)) {
    spec = await fetchGlobalAutohomeSpec(url);
    if (!spec) return NextResponse.json({ ok: false, reason: "parse_failed", message: "Couldn't read spec data from that global AutoHome page." }, { status: 422 });
  } else if (isAutohomeCnConfigUrl(url)) {
    // Obfuscated CN page: Vostro Playwright screenshots → vision LLM reads pixels.
    if (!process.env.EXTRACTOR_URL) {
      return NextResponse.json({ ok: false, reason: "cn_needs_extractor", message: "Chinese AutoHome config pages are obfuscated. Use the global site (global.autohome.com/en-hk/config/spec/<id>) or enable the Vostro spec extractor (EXTRACTOR_URL) + a vision model (Ollama qwen2.5-vl)." }, { status: 422 });
    }
    const cap = await captureCnSpec(url);
    if (!cap || !cap.screenshots?.length) {
      return NextResponse.json({ ok: false, reason: "capture_failed", message: "The spec extractor couldn't capture that page (down, or the page didn't render)." }, { status: 502 });
    }
    const vis = await llmVision({ system: VISION_SYSTEM, user: "Extract the full configuration table from these screenshots into the JSON schema.", images: cap.screenshots, maxTokens: 3000 });
    if (!vis) {
      return NextResponse.json({ ok: false, reason: "vision_unavailable", message: "No vision model configured. Set LLM_PROVIDER=openai + LLM_API_URL (Ollama) and `ollama pull qwen2.5-vl`." }, { status: 422 });
    }
    spec = parseVisionSpec(vis, url);
    if (!spec) {
      return NextResponse.json({ ok: false, reason: "parse_failed", message: "Couldn't read a usable spec table from the page screenshots — try the global AutoHome site." }, { status: 422 });
    }
    if (Array.isArray(cap.images) && cap.images.length) spec.gallery = cap.images.slice(0, 6);
  } else {
    return NextResponse.json({ ok: false, reason: "unsupported_url", message: "Paste a global.autohome.com config/spec URL (or a car.autohome.com.cn/config URL once the extractor is enabled)." }, { status: 422 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("cars")
    .update({ spec_data: spec, spec_captured_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  logAdminAction(request, { action: "update", entity: "car", entity_id: id, diff: { spec_import: spec.source, trims: spec.trims.length } }).catch(() => {});
  return NextResponse.json({ ok: true, spec: { source: spec.source, brand: spec.brand, model: spec.model, groups: spec.groups, trims: spec.trims.length, paramCount: spec.trims[0] ? Object.values(spec.trims[0].params).reduce((a, g) => a + Object.keys(g).length, 0) : 0 } });
}
