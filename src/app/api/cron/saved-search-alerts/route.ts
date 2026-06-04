import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { savedSearchAlertEmail, type EmailLocale } from "@/lib/email";
import { sendToCustomer } from "@/lib/customer-messaging";
import { priceFromMonthly } from "@/lib/finance";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Saved-search match alerts.
 *
 * The retention loop previously fired only on price drops (price_watches). A
 * customer who saved a search ("BYD SUV under $30k") was never told when a NEW
 * car matching it arrived. This sweep closes that gap: for each saved search it
 * runs the stored filters against cars created since the search's watermark
 * (last_alerted_at, or created_at on the first run), and if there are new
 * matches it emails + pushes the customer, then advances the watermark so the
 * same car never triggers twice.
 *
 * Per-run caps bound blast radius (a careless bulk car import can't storm every
 * customer in one tick; the next sweep picks up the remainder). Fail-open: a
 * notification problem never fails the sweep — the watermark just isn't advanced
 * so a later run retries once Resend/VAPID are configured.
 */
const MAX_SEARCHES = 100; // saved searches processed per run
const MAX_MATCHES = 6; // cars listed per alert

type FiltersRecord = Record<string, unknown>;

interface SavedSearchRow {
  id: string;
  label: string | null;
  filters: FiltersRecord | null;
  last_alerted_at: string | null;
  created_at: string;
  customer_id: string;
}

interface CustomerLite {
  id: string;
  email: string | null;
  locale: string | null;
  telegram_id: number | null;
  notify_channel: string | null;
}

interface MatchedCar {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number | null;
  price_usd: number;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

import { sanitizePostgrestSearchTerm as sanitizeSearch } from "@/lib/search-safe";

function localeOf(c: CustomerLite): EmailLocale {
  return c.locale === "uz" || c.locale === "en" ? c.locale : "ru";
}

/**
 * Run one saved search's filters against cars created strictly after the
 * watermark. Mirrors the public /api/cars filter keys (brand, body_type,
 * fuel_type, price_min/price_max, monthly_max, hot_only, search).
 */
async function findNewMatches(
  supabase: SupabaseClient,
  filters: FiltersRecord,
  watermark: string,
): Promise<MatchedCar[]> {
  // Resolve a fuzzy text search to ids first (same trigram RPC the catalog uses).
  let searchIds: string[] | null = null;
  const rawSearch = asString(filters.search) ?? asString(filters.q);
  const search = rawSearch ? sanitizeSearch(rawSearch) : null;
  if (search) {
    const { data: rpc } = await supabase.rpc("search_cars_ids", { q: search, max_results: 200 });
    if (Array.isArray(rpc) && rpc.length > 0) {
      searchIds = rpc.map((r: { id: string }) => r.id);
    } else {
      // No trigram hits → nothing new can match this run.
      return [];
    }
  }

  let query = supabase
    .from("cars")
    .select("id, slug, brand, model, year, price_usd, inventory_status, created_at")
    .neq("inventory_status", "sold")
    .gt("created_at", watermark);

  const brand = asString(filters.brand);
  const bodyType = asString(filters.body_type);
  const fuelType = asString(filters.fuel_type);
  if (brand) query = query.eq("brand", brand);
  if (bodyType) query = query.eq("body_type", bodyType);
  if (fuelType) query = query.eq("fuel_type", fuelType);

  const priceMin = asNumber(filters.price_min);
  if (priceMin !== null) query = query.gte("price_usd", priceMin);

  const priceMaxRaw = asNumber(filters.price_max);
  const monthlyMax = asNumber(filters.monthly_max);
  const ceilingFromMonthly = monthlyMax !== null ? Math.floor(priceFromMonthly(monthlyMax)) : null;
  const priceMax =
    priceMaxRaw !== null && ceilingFromMonthly !== null
      ? Math.min(priceMaxRaw, ceilingFromMonthly)
      : priceMaxRaw ?? ceilingFromMonthly;
  if (priceMax !== null) query = query.lte("price_usd", priceMax);

  if (filters.hot_only === true || filters.hot_only === "true") {
    query = query.eq("is_hot_offer", true);
  }
  if (searchIds) query = query.in("id", searchIds);

  query = query.order("created_at", { ascending: false }).limit(MAX_MATCHES);

  const { data, error } = await query;
  if (error || !data) return [];
  return data
    .filter((c) => typeof c.price_usd === "number")
    .map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      brand: c.brand as string,
      model: c.model as string,
      year: (c.year as number | null) ?? null,
      price_usd: c.price_usd as number,
    }));
}

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();

    // Oldest-alerted first (NULLS FIRST) so no search is starved by the cap.
    const { data: searches, error: searchErr } = await supabase
      .from("saved_searches")
      .select("id, label, filters, last_alerted_at, created_at, customer_id")
      .order("last_alerted_at", { ascending: true, nullsFirst: true })
      .limit(MAX_SEARCHES);

    if (searchErr) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }
    const rows = (searches || []) as SavedSearchRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, searches: 0, alerts: 0 });
    }

    // Batch-load the customers + their push subscriptions up front.
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
    const { data: customers } = await supabase
      .from("customers")
      .select("id, email, locale, telegram_id, notify_channel")
      .in("id", customerIds);
    const customerById = new Map<string, CustomerLite>(
      (customers || []).map((c) => [c.id as string, c as CustomerLite]),
    );

    let alerts = 0;
    for (const row of rows) {
      const customer = customerById.get(row.customer_id);
      if (!customer) continue;

      const watermark = row.last_alerted_at ?? row.created_at;
      const matches = await findNewMatches(supabase, row.filters ?? {}, watermark);
      if (matches.length === 0) continue;

      const locale = localeOf(customer);
      const tpl = savedSearchAlertEmail(locale, {
        label: row.label,
        total: matches.length,
        cars: matches.map((m) => ({
          name: `${m.brand} ${m.model}${m.year ? ` ${m.year}` : ""}`,
          price: m.price_usd,
          slug: m.slug,
        })),
      });

      const lead = matches[0];
      const res = await sendToCustomer(
        supabase,
        {
          id: customer.id,
          email: customer.email,
          telegram_id: customer.telegram_id,
          locale,
          notify_channel: customer.notify_channel,
        },
        {
          title: locale === "uz" ? "Yangi avtomobillar" : locale === "en" ? "New cars" : "Новые авто",
          body: `${lead.brand} ${lead.model}${matches.length > 1 ? ` +${matches.length - 1}` : ""}`,
          url: `/${locale}/catalog`,
          buttonLabel: locale === "uz" ? "Katalog" : locale === "en" ? "Browse" : "Каталог",
          email: { subject: tpl.subject, html: tpl.html },
          pushTag: `saved-search-${row.id}`,
          kind: "saved_search",
        },
      );
      const delivered = res.delivered;

      // Advance the watermark when something was delivered, or when there is no
      // channel we could ever deliver to (so we don't re-scan it forever). If a
      // channel exists but the send failed transiently, leave it for next run.
      const noChannels = !customer.email && !customer.telegram_id;
      if (delivered || noChannels) {
        await supabase
          .from("saved_searches")
          .update({ last_alerted_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      if (delivered) alerts += 1;
    }

    logEvent("cron.saved_search_alerts", { searches: rows.length, alerts });
    return NextResponse.json({ ok: true, searches: rows.length, alerts });
  } catch (error) {
    reportServerError("GET /api/cron/saved-search-alerts", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
