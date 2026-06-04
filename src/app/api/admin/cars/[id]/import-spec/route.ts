import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { fetchGlobalAutohomeSpec, isAutohomeGlobalUrl, isAutohomeCnConfigUrl, type SpecData } from "@/lib/autohome-spec";

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
    // Phase AD-2: proxy to the Vostro extractor (screenshots) → vision LLM.
    return NextResponse.json({ ok: false, reason: "cn_needs_extractor", message: "Chinese AutoHome config pages are obfuscated — use the global site (global.autohome.com/en-hk/config/spec/<id>) or enable the Vostro spec extractor + vision model." }, { status: 422 });
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
