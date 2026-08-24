/**
 * Canonical UUID matcher for anything that reaches a `uuid` column.
 *
 * The old `/^[a-f0-9-]{1,64}$/i` guard let bare values like "8" through — a
 * stale numeric id left in a visitor's localStorage from the pre-UUID era —
 * and Postgres answered with `22P02 invalid input syntax for type uuid`, which
 * failed the whole request and paged the dealer on Telegram. Filter to real
 * UUIDs at the edge instead: a bad id is dropped, the rest of the page loads.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Parse a comma-separated id list into de-duped UUIDs, capped at `max`. */
export function parseUuidList(raw: string | null, max = 100): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (isUuid(id)) seen.add(id.toLowerCase());
    if (seen.size >= max) break;
  }
  return Array.from(seen);
}
