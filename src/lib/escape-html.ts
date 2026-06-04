/**
 * HTML escape — one implementation across the codebase (was duplicated 8 ways).
 *
 * Handles BOTH attribute and text contexts: escapes &, <, >, ", and ' so the
 * same helper is safe to use anywhere we interpolate untrusted strings into
 * HTML/email/PDF output. (Some of the original locals did only & < > which is
 * fine for text but not for attribute values — the unified version is strictly
 * safer.)
 *
 * Renders nothing for null/undefined.
 */
export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
