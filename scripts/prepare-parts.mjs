import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const env = {};
const lines = readFileSync(".env.local", "utf8").split("\n");
for (const line of lines) {
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await sb
    .from("parts")
    .select("slug, name_en, fits_brands, fits_models")
    .eq("is_published", false)
    .gte("created_at", today);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const parts = data.map(p => ({
    slug: p.slug,
    name_en: p.name_en || "",
    brand: (p.fits_brands || [])[0] || "",
    model: (p.fits_models || [])[0] || ""
  }));

  const subsDir = join(process.cwd(), "subs");
  try { mkdirSync(subsDir); } catch {}
  
  const filePath = join(subsDir, "parts-for-accio.json");
  writeFileSync(filePath, JSON.stringify(parts, null, 2));
  console.log(`Wrote ${parts.length} parts to ${filePath}`);
}

main();
