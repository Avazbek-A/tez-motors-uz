/**
 * Parse a single HTTP `Range` header against a known resource size.
 *
 * Supports the two forms browsers' <audio>/<video> elements actually send:
 *   bytes=START-END   (END optional → to the end of the resource)
 *   bytes=-SUFFIX     (the last SUFFIX bytes)
 *
 * Returns the resolved inclusive {start, end} byte offsets, or null when the
 * header is absent/malformed/unsatisfiable — callers then serve the full 200
 * body (RFC 7233 permits ignoring an unsatisfiable Range). Multi-range requests
 * (a comma-separated set) are intentionally unsupported → null → full body.
 */
export function parseRange(header: string | null | undefined, size: number): { start: number; end: number } | null {
  if (!header || size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // Suffix form: last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}
