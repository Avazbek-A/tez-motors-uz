/**
 * CRM segments — audience definitions + pure contact-dedupe (unit-tested). A
 * segment is computed live from existing data (no stored membership); the route
 * runs the query, this module defines the catalog and merges rows into unique
 * reachable contacts.
 */
import { contactKey, pickFirst } from "./crm";

export type SegmentChannel = "auto" | "email" | "sms";

export interface SegmentDef {
  key: string;
  label: string;
  description: string;
  /** Channels that make sense for this audience. */
  channels: SegmentChannel[];
}

export const SEGMENTS: SegmentDef[] = [
  {
    key: "open_inquiry",
    label: "Open inquiries",
    description: "People who reached out and aren't closed yet — nudge them back.",
    channels: ["auto", "sms", "email"],
  },
  {
    key: "hot_handoff",
    label: "Hot AI leads",
    description: "Conversations the assistant flagged for handoff (last 14 days).",
    channels: ["auto", "sms"],
  },
  {
    key: "abandoned_deposit",
    label: "Unpaid reservations",
    description: "Reserved a car but never paid the deposit.",
    channels: ["auto", "sms", "email"],
  },
  {
    key: "delivered",
    label: "Past buyers",
    description: "Orders delivered — ask for a review or a referral.",
    channels: ["auto", "sms", "email"],
  },
  {
    key: "account_holders",
    label: "All registered customers",
    description: "Everyone with an account — broad announcements.",
    channels: ["auto", "sms", "email"],
  },
];

export function segmentDef(key: string): SegmentDef | undefined {
  return SEGMENTS.find((s) => s.key === key);
}

export interface RawContact {
  phone?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface SegContact {
  key: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  customerId?: string | null;
  telegramId?: number | string | null;
  notifyChannel?: string | null;
  locale?: string | null;
}

/** Dedupe raw rows into unique contacts keyed by phone core, merging best name/email. */
export function dedupeContacts(rows: RawContact[]): SegContact[] {
  const map = new Map<string, SegContact>();
  let anon = 0;
  for (const r of rows) {
    const key = contactKey(r.phone);
    // Email-only contacts (no phone) still count, keyed by lowercased email.
    const id = key || (r.email ? `email:${r.email.toLowerCase()}` : `anon:${anon++}`);
    const existing = map.get(id);
    if (existing) {
      existing.name = pickFirst([existing.name, r.name ?? null]);
      existing.email = pickFirst([existing.email, r.email ?? null]);
      existing.phone = pickFirst([existing.phone, r.phone ?? null]);
    } else {
      map.set(id, { key: id, phone: r.phone ?? null, name: r.name ?? null, email: r.email ?? null });
    }
  }
  return Array.from(map.values());
}

/** Personalize a message body — replaces {name} with the contact's name (or a fallback). */
export function personalize(body: string, name: string | null, locale = "ru"): string {
  const fallback = locale === "uz" ? "hurmatli mijoz" : locale === "en" ? "there" : "уважаемый клиент";
  return body.replace(/\{name\}/gi, (name || fallback).trim());
}
