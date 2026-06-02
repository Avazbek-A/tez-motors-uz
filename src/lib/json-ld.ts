/**
 * Safely serialize a JSON-LD object for embedding in a
 * `<script type="application/ld+json">` via dangerouslySetInnerHTML.
 *
 * Escapes `<` as `<` so a value containing `</script>` (or `<!--`) can't
 * break out of the script element — the classic JSON-in-HTML XSS. The output
 * is still valid JSON that search engines parse normally.
 */
export function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
