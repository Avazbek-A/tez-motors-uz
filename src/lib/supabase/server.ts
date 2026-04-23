import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Re-export service client so existing `from "@/lib/supabase/server"` imports
// from Server Components / Route Handlers keep working. New code should
// import from "@/lib/supabase/service" directly.
export { createServiceClient } from "./service";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component - can't set cookies
          }
        },
      },
    }
  );
}
