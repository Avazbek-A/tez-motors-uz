/**
 * PostgREST-safe search-term sanitizer.
 *
 * Public catalog routes (cars, parts) interpolate the user's search term into
 * a `.or()` filter — e.g. `query.or("brand.ilike.%${q}%,model.ilike.%${q}%")`.
 * PostgREST treats `,` as a clause separator, `()` as group delimiters, and
 * `%`/`*` as LIKE/ILIKE wildcards. A raw user term containing any of those
 * could break out of its position in the filter expression: a leading `,` adds
 * an attacker-chosen clause; a `%` injects a wildcard that wasn't intended.
 *
 * Strip all of them. Cap to 64 chars so a megabyte-long term can't be turned
 * into an `.or()` of pathological length that the database has to plan.
 *
 * Note: this is NOT the same as `assistant-core.sanitizeSearch`, which feeds a
 * free-text natural-language message and prefers to *replace* the punctuation
 * with spaces (so words don't run together) — that variant lives there.
 */
export function sanitizePostgrestSearchTerm(raw: string): string {
  return raw.replace(/[,()\\%*]/g, "").slice(0, 64);
}
