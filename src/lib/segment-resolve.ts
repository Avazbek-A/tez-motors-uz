/**
 * Server-side segment resolution — runs the query for a segment key and returns
 * deduped reachable contacts. Kept out of segments.ts so that module stays
 * pure/unit-testable; this one touches Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeContacts, type RawContact, type SegContact } from "./segments";
import { contactKey } from "./crm";

const LIMIT = 3000;

export async function resolveSegmentContacts(supabase: SupabaseClient, key: string): Promise<SegContact[]> {
  let rows: RawContact[] = [];

  switch (key) {
    case "open_inquiry": {
      const { data } = await supabase
        .from("inquiries")
        .select("phone, name, email, status")
        .in("status", ["new", "contacted", "in_progress"])
        .limit(LIMIT);
      rows = (data || []).map((r) => ({ phone: r.phone as string, name: r.name as string, email: r.email as string }));
      break;
    }
    case "hot_handoff": {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("assistant_conversations")
        .select("phone, name, last_message_at")
        .eq("handoff", true)
        .not("phone", "is", null)
        .gte("last_message_at", since)
        .limit(LIMIT);
      rows = (data || []).map((r) => ({ phone: r.phone as string, name: r.name as string }));
      break;
    }
    case "abandoned_deposit": {
      const { data } = await supabase
        .from("orders")
        .select("customer_phone, customer_name, customer_email")
        .eq("status", "ordered")
        .limit(LIMIT);
      rows = (data || []).map((r) => ({ phone: r.customer_phone as string, name: r.customer_name as string, email: r.customer_email as string }));
      break;
    }
    case "delivered": {
      const { data } = await supabase
        .from("orders")
        .select("customer_phone, customer_name, customer_email")
        .eq("status", "delivered")
        .limit(LIMIT);
      rows = (data || []).map((r) => ({ phone: r.customer_phone as string, name: r.customer_name as string, email: r.customer_email as string }));
      break;
    }
    case "account_holders": {
      const { data } = await supabase.from("customers").select("phone, name, email").limit(LIMIT);
      rows = (data || []).map((r) => ({ phone: r.phone as string, name: r.name as string, email: r.email as string }));
      break;
    }
    default:
      return [];
  }

  const contacts = dedupeContacts(rows);
  await enrichCustomerChannels(supabase, contacts);
  return contacts;
}

async function enrichCustomerChannels(supabase: SupabaseClient, contacts: SegContact[]): Promise<void> {
  const phones = Array.from(new Set(contacts.map((c) => contactKey(c.phone)).filter(Boolean) as string[]));
  const emails = Array.from(new Set(contacts.map((c) => c.email?.trim().toLowerCase()).filter(Boolean) as string[]));
  if (phones.length === 0 && emails.length === 0) return;

  const byPhone = new Map<string, SegContact[]>();
  const byEmail = new Map<string, SegContact[]>();
  for (const c of contacts) {
    const p = contactKey(c.phone);
    if (p) byPhone.set(p, [...(byPhone.get(p) || []), c]);
    const e = c.email?.trim().toLowerCase();
    if (e) byEmail.set(e, [...(byEmail.get(e) || []), c]);
  }

  const batches = [
    ...chunk(phones, 200).map((batch) =>
      supabase
        .from("customers")
        .select("id, phone, email, telegram_id, notify_channel, locale")
        .in("phone", batch)
        .then((r) => r.data ?? [], () => []),
    ),
    ...chunk(emails, 200).map((batch) =>
      supabase
        .from("customers")
        .select("id, phone, email, telegram_id, notify_channel, locale")
        .in("email", batch)
        .then((r) => r.data ?? [], () => []),
    ),
  ];

  const rows = (await Promise.all(batches)).flat();
  for (const r of rows) {
    const matches = new Set<SegContact>();
    const p = contactKey(r.phone as string);
    if (p) for (const c of byPhone.get(p) || []) matches.add(c);
    const e = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    if (e) for (const c of byEmail.get(e) || []) matches.add(c);
    for (const c of matches) {
      c.customerId = c.customerId ?? (r.id as string);
      c.telegramId = c.telegramId ?? ((r.telegram_id as string | number | null) || null);
      c.notifyChannel = c.notifyChannel ?? ((r.notify_channel as string | null) || null);
      c.locale = c.locale ?? ((r.locale as string | null) || null);
      c.email = c.email ?? ((r.email as string | null) || null);
      c.phone = c.phone ?? ((r.phone as string | null) || null);
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
