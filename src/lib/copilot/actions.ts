/**
 * Dealer Copilot — shared business operations (Phase AE).
 *
 * Resolvers + write actions used by BOTH the web copilot route and the Telegram
 * operator path. Every write is audited (with an explicit operator actor, since
 * chat has no admin cookie) and reuses the SAME notify helpers the admin routes
 * use (notifyPriceWatchers, notifyOrderStatus). Service-role client is passed in.
 *
 * Pure helpers (normalizeName, scoreMatch, computeMarkdownPrice) are unit-tested;
 * the DB ops fail-soft and return a typed result the caller turns into a message.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyPriceWatchers } from "@/lib/price-watch";
import { ORDER_STATUSES, notifyOrderStatus } from "@/lib/order-status";
import { logAdminAction } from "@/lib/audit";

const OPERATOR_ACTOR = { email: "operator:copilot" };

export const norm = (s: string | null | undefined) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Token-overlap score of a query against a car's "brand model" name. */
export function scoreMatch(query: string, name: string): number {
  const q = new Set(norm(query).split(" ").filter(Boolean));
  const n = norm(name);
  if (!q.size) return 0;
  let hit = 0;
  for (const t of q) if (n.includes(t)) hit++;
  return hit / q.size;
}

export interface CarRow {
  id: string; slug: string; brand: string; model: string; year: number | null;
  price_usd: number; original_price_usd: number | null; inventory_status: string;
}

export interface ResolveResult<T> { match?: T; candidates?: T[]; }

/** Find a sellable car by free-text name. Clear winner → match; else candidates. */
export async function resolveCar(supabase: SupabaseClient, query: string): Promise<ResolveResult<CarRow>> {
  const { data } = await supabase
    .from("cars")
    .select("id, slug, brand, model, year, price_usd, original_price_usd, inventory_status")
    .neq("inventory_status", "sold")
    .limit(500);
  const rows = (data || []) as CarRow[];
  if (!rows.length || !norm(query)) return {};
  const scored = rows
    .map((c) => ({ c, s: scoreMatch(query, `${c.brand} ${c.model} ${c.year ?? ""}`) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (!scored.length) return {};
  // Clear winner: top score full (==1) and strictly better than the runner-up.
  if (scored[0].s >= 1 && (scored.length === 1 || scored[1].s < scored[0].s)) return { match: scored[0].c };
  if (scored.length === 1) return { match: scored[0].c };
  return { candidates: scored.slice(0, 4).map((x) => x.c) };
}

/** Compute a markdown target price from {priceUsd} or {pct}. Returns null if invalid. */
export function computeMarkdownPrice(current: number, opts: { priceUsd?: number | null; pct?: number | null }): number | null {
  let target: number | null = null;
  if (typeof opts.priceUsd === "number" && opts.priceUsd > 0) target = Math.round(opts.priceUsd);
  else if (typeof opts.pct === "number" && opts.pct > 0 && opts.pct < 90) target = Math.round(current * (1 - opts.pct / 100));
  if (target == null || target <= 0 || target >= current) return null;
  return target;
}

export interface ActionResult { ok: boolean; message: string; }

/** Apply a markdown to a car: lower price_usd, preserve original_price_usd, notify watchers, audit. */
export async function applyCarMarkdown(
  supabase: SupabaseClient,
  car: CarRow,
  newPriceUsd: number,
): Promise<ActionResult> {
  const original = car.original_price_usd && car.original_price_usd > newPriceUsd ? car.original_price_usd : car.price_usd;
  const { error } = await supabase
    .from("cars")
    .update({ price_usd: newPriceUsd, original_price_usd: original, updated_at: new Date().toISOString() })
    .eq("id", car.id);
  if (error) return { ok: false, message: `Не удалось изменить цену: ${error.message}` };
  notifyPriceWatchers(supabase, { id: car.id, slug: car.slug, brand: car.brand, model: car.model, year: car.year, price_usd: newPriceUsd }).catch(() => {});
  logAdminAction(null, { action: "update", entity: "car", entity_id: car.id, actor: OPERATOR_ACTOR, diff: { from: car.price_usd, to: newPriceUsd, via: "copilot" } }).catch(() => {});
  return { ok: true, message: `Цена ${car.brand} ${car.model} снижена: $${car.price_usd.toLocaleString("en-US")} → $${newPriceUsd.toLocaleString("en-US")}.` };
}

export interface OrderRow {
  id: string; reference_code: string; status: string; customer_email: string | null;
  customer_phone: string | null; locale: string | null;
  cars: { brand: string; model: string; year: number } | { brand: string; model: string; year: number }[] | null;
}

export async function resolveOrder(supabase: SupabaseClient, ref: string): Promise<OrderRow | null> {
  const { data } = await supabase
    .from("orders")
    .select("id, reference_code, status, customer_email, customer_phone, locale, cars(brand, model, year)")
    .eq("reference_code", ref.toUpperCase())
    .maybeSingle();
  return (data as OrderRow) || null;
}

/** Next status in the pipeline after the current one (null if already final). */
export function nextOrderStatus(current: string): string | null {
  const i = (ORDER_STATUSES as readonly string[]).indexOf(current);
  if (i < 0 || i >= ORDER_STATUSES.length - 1) return null;
  return ORDER_STATUSES[i + 1];
}

/** Advance an order to a target (or the next) status: update + event + notify + audit. */
export async function advanceOrder(
  supabase: SupabaseClient,
  order: OrderRow,
  target: string,
): Promise<ActionResult> {
  if (!(ORDER_STATUSES as readonly string[]).includes(target)) return { ok: false, message: `Неизвестный статус: ${target}` };
  if (target === order.status) return { ok: false, message: `Заказ уже в статусе ${target}.` };
  const { error } = await supabase.from("orders").update({ status: target, updated_at: new Date().toISOString() }).eq("id", order.id);
  if (error) return { ok: false, message: `Не удалось обновить заказ: ${error.message}` };
  await supabase.from("order_events").insert({ order_id: order.id, status: target, note: "via copilot" });
  const carRel = order.cars;
  const car = Array.isArray(carRel) ? carRel[0] : carRel;
  const carName = car ? `${car.brand} ${car.model} ${car.year}` : "Ваш автомобиль";
  notifyOrderStatus(supabase, { referenceCode: order.reference_code, locale: order.locale, customerEmail: order.customer_email, customerPhone: order.customer_phone ?? "", carName }, target).catch(() => {});
  logAdminAction(null, { action: "status_change", entity: "order", entity_id: order.id, actor: OPERATOR_ACTOR, diff: { reference_code: order.reference_code, from: order.status, to: target, via: "copilot" } }).catch(() => {});
  return { ok: true, message: `Заказ ${order.reference_code}: ${order.status} → ${target}. Клиент уведомлён.` };
}

/** Create a DRAFT purchase order (never 'ordered' — dealer reviews/sends). */
const MAX_DRAFT_PO_QTY = 100;
export async function createDraftPo(
  supabase: SupabaseClient,
  input: { brand: string; model: string; qty: number },
): Promise<ActionResult> {
  // Clamp qty to a sane range. The rule-based extractor matches `\d{1,3}` (max
  // 999) but the LLM path could return any number — defensively cap at 100
  // here so a malformed classification can't drop a "1 000 000 BYD" draft in
  // front of the dealer (a draft is not sent, but it's still UI noise + an
  // audit row + a row in purchase_orders).
  const qty = Math.min(MAX_DRAFT_PO_QTY, Math.max(1, Math.floor(input.qty) || 1));
  // Cap brand/model strings — defense in depth against an LLM that returns a
  // megabyte of text where a noun phrase was expected.
  const brand = String(input.brand).slice(0, 60);
  const model = String(input.model).slice(0, 80);
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ brand, model, qty, status: "draft", notes: "Draft created by copilot — review and send." })
    .select("id")
    .single();
  if (error) return { ok: false, message: `Не удалось создать черновик заявки: ${error.message}` };
  logAdminAction(null, { action: "create", entity: "purchase_order", entity_id: data?.id ?? null, actor: OPERATOR_ACTOR, diff: { brand, model, qty, status: "draft", via: "copilot" } }).catch(() => {});
  return { ok: true, message: `Черновик заявки поставщику создан: ${qty}× ${brand} ${model}. Откройте «Закупки», чтобы отправить.` };
}

/** Split a free-text model phrase into {brand, model} using a known-brand prefix. */
export function splitBrandModel(phrase: string, brands: readonly string[]): { brand: string; model: string } {
  const p = phrase.trim();
  const lower = p.toLowerCase();
  const brand = brands.find((b) => lower.startsWith(b.toLowerCase()));
  if (brand) return { brand, model: p.slice(brand.length).trim() || p };
  const [first, ...rest] = p.split(/\s+/);
  return { brand: first || p, model: rest.join(" ") || p };
}
