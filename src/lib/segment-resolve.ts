/**
 * Server-side segment resolution — runs the query for a segment key and returns
 * deduped reachable contacts. Kept out of segments.ts so that module stays
 * pure/unit-testable; this one touches Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeContacts, type RawContact, type SegContact } from "./segments";

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

  return dedupeContacts(rows);
}
