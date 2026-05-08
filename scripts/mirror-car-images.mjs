#!/usr/bin/env node
/**
 * Walk every car's `images[]`, download anything not yet hosted on our
 * own Supabase Storage bucket (`car-images`), upload it, then rewrite
 * the URL in the row.
 *
 * Why: today the seeded photos point at upload.wikimedia.org. That
 * works but couples us to their CDN's hot-link policy and TLS handshake.
 * Mirroring decouples + makes the URLs predictable + opens the door to
 * future image transforms.
 *
 * Idempotent: URLs already on our bucket are skipped.
 *
 * Usage: node scripts/mirror-car-images.mjs
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB — Wikimedia full-res can be hefty
const FETCH_TIMEOUT_MS = 30000;
const BUCKET = "car-images";

async function loadEnv() {
  const text = await readFile(resolve(ROOT, ".env.production"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

function extensionForMime(mime) {
  return mime === "image/jpeg" ? "jpg"
       : mime === "image/png"  ? "png"
       : mime === "image/webp" ? "webp"
       : mime === "image/gif"  ? "gif"
       : "bin";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, { tries = 5, baseDelay = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "User-Agent": "tez-motors-mirror/1.0 (https://tezmotors.uz)" },
      });
      if (res.status === 429 || res.status === 503) {
        // Honor Retry-After if present, else exponential backoff.
        const ra = parseInt(res.headers.get("retry-after") ?? "0", 10);
        const wait = ra > 0 ? ra * 1000 : baseDelay * Math.pow(2, i);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await sleep(baseDelay * Math.pow(2, i));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr ?? new Error("retry budget exhausted");
}

async function main() {
  const env = await loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ownPrefix = `${supabaseUrl}/storage/v1/object/public/`;

  const { data: cars, error } = await supabase
    .from("cars")
    .select("id, slug, images, thumbnail")
    .order("order_position");
  if (error) {
    console.error("DB read error:", error);
    process.exit(1);
  }

  let mirrored = 0;
  let unchanged = 0;
  let failed = 0;

  for (const car of cars ?? []) {
    const inputs = (car.images ?? []).filter(Boolean);
    if (inputs.length === 0) continue;

    const next = [];
    let dirty = false;

    for (const url of inputs) {
      if (url.startsWith(ownPrefix)) {
        next.push(url);
        unchanged += 1;
        continue;
      }

      try {
        // 700 ms gentle pacing between fetches keeps Wikimedia happy
        // and is well within their robot etiquette window.
        await sleep(700);
        const res = await fetchWithRetry(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
        if (!ALLOWED_MIME.has(mime)) throw new Error(`bad MIME ${mime}`);

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_BYTES) throw new Error("too large");

        const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
        const path = `${car.slug}/${hash}.${extensionForMime(mime)}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: mime, upsert: true });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        next.push(pub.publicUrl);
        mirrored += 1;
        process.stdout.write(".");
      } catch (e) {
        failed += 1;
        console.error(`\n  FAIL ${car.slug} ${url}: ${e.message}`);
        next.push(url); // keep original on failure
      }
    }

    if (next.length === inputs.length && next.some((u, i) => u !== inputs[i])) {
      dirty = true;
    }

    if (dirty) {
      const { error: updErr } = await supabase
        .from("cars")
        .update({ images: next, thumbnail: next[0] })
        .eq("id", car.id);
      if (updErr) {
        console.error(`\n  UPDATE FAIL ${car.slug}:`, updErr.message);
      } else {
        console.log(` ✓ ${car.slug}`);
      }
    }
  }

  console.log(`\nDone: mirrored ${mirrored}, unchanged ${unchanged}, failed ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
