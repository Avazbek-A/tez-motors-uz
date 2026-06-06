import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Fetch ALL rows of a Supabase query across pages, bypassing PostgREST's
 * `db-max-rows` cap. Aggregating routes that did `.select(col).limit(5000)` and
 * summed the result silently undercounted once the table exceeded that cap; this
 * walks `.range()` until a short page is returned.
 *
 * `range(from, to)` must apply `.range(from, to)` to a FRESH query (same filters
 * each call) and return the awaitable result. Stops when a page returns fewer
 * than `pageSize` rows, on error, or at the `maxRows` safety ceiling.
 */
export async function fetchAllRows<T>(
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  opts?: { pageSize?: number; maxRows?: number },
): Promise<T[]> {
  const pageSize = Math.max(1, opts?.pageSize ?? 1000);
  const maxRows = opts?.maxRows ?? 200_000; // hard backstop so a bug can't loop forever
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break; // last (short) page
  }
  return out;
}
