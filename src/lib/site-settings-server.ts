import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  SiteSettingsSchema,
  mergeWithDefaults,
  type ResolvedSiteSettings,
} from "@/lib/site-settings";

export async function getSiteSettings(): Promise<ResolvedSiteSettings> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("site_settings")
      .select("values")
      .eq("id", "singleton")
      .maybeSingle();
    const parsed = SiteSettingsSchema.safeParse(data?.values ?? {});
    return mergeWithDefaults(parsed.success ? parsed.data : {});
  } catch {
    return mergeWithDefaults({});
  }
}
