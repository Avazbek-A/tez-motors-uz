import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = {};
const lines = readFileSync(".env.local", "utf8").split("\n");
for (const line of lines) {
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, count, error } = await sb
    .from("parts")
    .select("slug, name_en, fits_brands, fits_models", { count: "exact" })
    .eq("is_published", false);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(`Total unpublished parts: ${count}`);
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
}

main();
