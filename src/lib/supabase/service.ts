import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for trusted server-side admin operations.
 * Bypasses RLS — only call from routes already gated by requireAdmin().
 * Never expose this client or its results to untrusted callers.
 *
 * This file intentionally has NO dependency on `next/headers` so it can be
 * imported from edge middleware / shared libraries without pulling the
 * Server Component cookies API into the wrong runtime.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service role env vars missing");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
