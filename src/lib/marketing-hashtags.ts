/**
 * Blend real, currently-trending hashtags (mined from Instagram research by the
 * off-Workers collector, deploy/collector/instagram-collector.mjs → rankHashtags)
 * into AI-generated social copy. The LLM guesses generic tags; this appends the
 * real regional ones the dealer's audience actually follows, deduped against
 * whatever the copy already contains. Pure + unit-tested.
 */

/** Normalize a raw tag → a clean "#tag" (or "" if nothing usable remains). */
export function normalizeTag(raw: string): string {
  if (!raw) return "";
  // Keep letters (any script), digits, underscore; drop the rest. Strip leading #s.
  const body = String(raw).trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return body ? `#${body}` : "";
}

/** Case-insensitive set of hashtags already present in some text. */
function presentTags(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.match(/#[\p{L}\p{N}_]+/gu) || []) out.add(m.toLowerCase());
  return out;
}

/**
 * Append up to `maxAdd` trending tags not already in `text`. Returns the text
 * unchanged when there's nothing to add. New tags go on their own line so they
 * don't disrupt the copy body.
 */
export function mergeHashtags(text: string, trending: string[] | null | undefined, maxAdd = 8): string {
  if (!trending?.length || maxAdd <= 0) return text;
  const have = presentTags(text);
  const added: string[] = [];
  const addedKeys = new Set<string>();
  for (const raw of trending) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (have.has(key) || addedKeys.has(key)) continue;
    added.push(tag);
    addedKeys.add(key);
    if (added.length >= maxAdd) break;
  }
  if (!added.length) return text;
  return `${text.trimEnd()}\n\n${added.join(" ")}`;
}

/** How many trending tags to add per content kind (0 = don't touch the copy). */
export function trendingTagBudget(kind: string): number {
  switch (kind) {
    case "instagram":
      return 8;
    case "telegram":
      return 4;
    case "facebook":
      return 2;
    default:
      return 0; // ad/blog/promo: hashtags are off-tone
  }
}
