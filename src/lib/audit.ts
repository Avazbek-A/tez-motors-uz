/**
 * Admin audit trail (Phase V2).
 *
 * `logAdminAction` writes one compact row to `admin_audit` for a privileged
 * write. It resolves the acting admin from the request's session cookie, so
 * callers only pass *what* happened, not *who*.
 *
 * Fail-open by design: auditing must NEVER break the action it records. Any
 * error (unbound table before the migration is applied, network blip, missing
 * session) is swallowed. Callers fire-and-forget: `logAdminAction(...).catch(() => {})`.
 */
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminSessionContext } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "restock"
  | "import"
  | "settings";

export interface AuditEntry {
  action: AuditAction | string;
  entity: string;
  entity_id?: string | null;
  /** Changed fields only — keep this small; never store full rows. */
  diff?: Record<string, unknown> | null;
  /**
   * Explicit actor override for callers WITHOUT an admin session cookie — the
   * Dealer Copilot's Telegram path and autonomous crons. When set, it wins over
   * cookie resolution (which would find nothing). e.g. { email: "operator:telegram" }.
   */
  actor?: { id?: string | null; email?: string | null } | null;
}

/**
 * Reduce an update payload to a compact, loggable diff: drop bulky/derived
 * fields (images, long descriptions, specs) so the audit row stays bounded.
 */
export function compactDiff(
  payload: Record<string, unknown> | null | undefined,
  drop: string[] = ["images", "specs", "description_ru", "description_uz", "description_en"],
): Record<string, unknown> | null {
  if (!payload) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (drop.includes(k)) {
      // Record that it changed without storing the blob.
      out[k] = Array.isArray(v) ? `[${v.length} items]` : "(changed)";
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function logAdminAction(
  request: NextRequest | Request | null,
  entry: AuditEntry,
): Promise<void> {
  try {
    // Explicit actor wins (Telegram/cron have no cookie); else resolve from session.
    const ctx = entry.actor ? null : request ? await getAdminSessionContext(request) : null;
    const supabase = createServiceClient();
    await supabase.from("admin_audit").insert({
      actor_admin_id: entry.actor?.id ?? ctx?.user?.id ?? null,
      actor_email: entry.actor?.email ?? ctx?.user?.email ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      diff: entry.diff ?? null,
      ip: request ? getClientIp(request) : null,
    });
  } catch {
    // fail-open
  }
}
