import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const MAPPING = {
  "tank-300-offroad-suv-uzbekistan-mountains": "/images/blog/tank_300.png",
  "top-5-chinese-evs-uzbekistan-2026": "/images/top_chinese_evs.png",
  "how-to-import-car-china-uzbekistan-safely": "/images/ev_logistics_truck.png",
  "kak-import-iz-kitaya": "/images/ev_logistics_truck.png",
  "byd-seagull-affordable-city-ev": "/images/byd_seagull.png",
  "byd-song-plus-ev-vs-song-l-comparison-uzbekistan": "/images/byd_song_comparison.png",
  "rastamozhka-uzbekistan-2026": "/images/customs_clearance_ev.png",
  "lixiang-li-auto-hybrid-suvs-uzbekistan-guide": "/images/lixiang_suvs.png",
  "byd-song-plus-2024-review": "/images/byd_song_plus.png",
  "byd-atto-3-yuan-plus-global-model": "/images/byd_yuan_plus.png",
  "zeekr-009-luxury-electric-mpv": "/images/zeekr_cars.png",
  "zeekr-x-compact-premium-suv": "/images/zeekr_cars.png",
  "lixiang-li-l6-cheapest-suv-review": "/images/lixiang_suvs.png",
  "lixiang-li-l8-6-seater-family-luxury": "/images/lixiang_suvs.png",
  "tank-500-luxury-land-cruiser-competitor": "/images/blog/tank_500.png",
  "changan-uni-k-futuristic-suv-review": "/images/blog/chinese_crossover.png",
  "jaecoo-j7-premium-urban-suv": "/images/blog/chinese_crossover.png",
  "ev-vs-petrol-cost-of-ownership-uzbekistan": "/images/blog/ev_vs_petrol.png",
  "how-to-avoid-scams-importing-car-china": "/images/blog/safe_import_docs.png",
  "winter-ev-battery-care-uzbekistan": "/images/blog/ev_charging_station_tashkent.png",
  "solid-state-batteries-future-ev-china": "/images/blog/ev_battery_tech.png",
  "chinese-ev-resale-value-uzbekistan": "/images/blog/new_vs_used_car.png",
  "hybrid-vs-ev-vs-petrol-uzbekistan-2026": "/images/blog/ev_vs_petrol.png",
  "best-chinese-cars-under-20000-uzbekistan": "/images/blog/brand_comparison_collage.png",
  "best-ev-for-taxi-yandex-tashkent": "/images/blog/ev_taxi_yandex.png",
  "cltc-vs-wltp-real-ev-range": "/images/blog/ev_range_dashboard.png",
  "byd-blade-battery-explained": "/images/blog/ev_battery_tech.png",
  "premium-chinese-cars-over-50000-uzbekistan": "/images/blog/brand_comparison_collage.png",
  "top-mistakes-importing-car-china-uzbekistan": "/images/blog/safe_import_docs.png",
  "chinese-car-warranty-service-uzbekistan": "/images/blog/car_service_diagnostic.png",
  "tank-model-29-max-import-guide-uz": "/images/blog/tank_500.png",
  "byd-model-30-ultra-import-guide-uz": "/images/byd_cars.png",
  "zeekr-model-31-flagship-import-guide-uz": "/images/zeekr_cars.png",
  "how-long-import-car-china-uzbekistan-takes": "/images/ev_logistics_truck.png",
  "li-auto-model-32-air-import-guide-uz": "/images/lixiang_suvs.png",
  "xiaomi-model-33-plus-import-guide-uz": "/images/xiaomi_su7.png",
  "geely-model-34-ev-import-guide-uz": "/images/byd_cars.png",
  "customs-clearance-ev-hybrid-uzbekistan-2026": "/images/customs_clearance_ev.png",
  "ev-charging-stations-uzbekistan-guide": "/images/blog/ev_charging_station_tashkent.png",
  "byd-seal-tesla-model-3-competitor": "/images/byd_seal.png",
  "zeekr-007-electric-sedan-features": "/images/zeekr_cars.png",
  "xiaomi-su7-buying-guide-tashkent": "/images/xiaomi_su7.png",
  "geely-monjaro-why-so-popular-tashkent": "/images/geely_monjaro.png",
  "are-chinese-cars-reliable-2026": "/images/blog/car_service_diagnostic.png",
  "byd-vs-zeekr-vs-xiaomi-which-brand": "/images/blog/brand_comparison_collage.png",
  "best-chinese-family-car-uzbekistan": "/images/byd_tang.png",
  "used-vs-new-car-import-uzbekistan": "/images/blog/new_vs_used_car.png",
  "range-anxiety-uzbekistan-reality": "/images/blog/ev_range_dashboard.png",
  "documents-registration-imported-car-uzbekistan": "/images/blog/uzbekistan_car_registration.png",
  "electric-suv-vs-sedan-uzbekistan": "/images/blog/suv_vs_sedan.png",
  "omoda-c5-stylish-youth-crossover": "/images/blog/chinese_crossover.png",
  "chery-tiggo-8-pro-max-7-seater": "/images/blog/chinese_crossover.png",
  "byd-han-ev-review-uzbekistan": "/images/byd_han.png",
  "byd-tang-family-suv-7-seats": "/images/byd_tang.png",
  "xiaomi-su7-max-performance-review": "/images/xiaomi_su7.png",
  "geely-coolray-best-compact-crossover": "/images/blog/chinese_crossover.png",
};

async function loadEnv() {
  const text = await readFile("./.env.local", "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env keys");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Fetching posts from Supabase...");
  const { data: posts, error: fetchError } = await supabase
    .from("posts")
    .select("id, slug, title_ru, cover_image");

  if (fetchError) {
    console.error("Failed to fetch posts:", fetchError);
    process.exit(1);
  }

  console.log(`Found ${posts.length} posts in the database.`);
  let updatedCount = 0;

  for (const post of posts) {
    const targetImage = MAPPING[post.slug];
    if (!targetImage) {
      console.warn(`No image mapping found for slug: ${post.slug}`);
      continue;
    }

    if (post.cover_image === targetImage) {
      console.log(`[SKIP] Post "${post.title_ru}" already has correct image: ${targetImage}`);
      continue;
    }

    console.log(`[UPDATE] Updating "${post.title_ru}" -> ${targetImage}`);
    const { error: updateError } = await supabase
      .from("posts")
      .update({ cover_image: targetImage })
      .eq("id", post.id);

    if (updateError) {
      console.error(`Failed to update post ${post.slug}:`, updateError);
    } else {
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} blog posts!`);
}

main().catch(console.error);
