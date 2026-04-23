import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { z } from "zod";

const checkRateLimit = createRateLimiter({ max: 3, windowMs: 10 * 60 * 1000 });
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 8000;
const MAX_FILES = 4;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = "car-images";

const schema = z.object({
  turnstile_token: z.string().max(4096).optional(),
});

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readDimensions(mime: string, bytes: Uint8Array): { width: number; height: number } | null {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: (((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0), height: (((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0) };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      let marker = bytes[offset + 1];
      while (marker === 0xff) { offset += 1; marker = bytes[offset + 1]; }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = readUInt16BE(bytes, offset + 2);
      const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSof && offset + 7 < bytes.length) return { width: readUInt16BE(bytes, offset + 7), height: readUInt16BE(bytes, offset + 5) };
      offset += 2 + length;
    }
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") {
      return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    }
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
}

function extForMime(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

function randomId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(getClientIp(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = schema.safeParse({ turnstile_token: form.get("turnstile_token") || undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ok = await verifyTurnstile(parsed.data.turnstile_token, getClientIp(request));
  if (!ok) {
    return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
  }

  const files = form.getAll("files").filter((item): item is File => item instanceof File).slice(0, MAX_FILES);
  if (files.length === 0) {
    return NextResponse.json({ error: "Missing files" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const urls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 413 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 415 });
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffMime(buffer);
    if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
      return NextResponse.json({ error: `File content mismatch: ${file.name}` }, { status: 415 });
    }
    const dims = readDimensions(sniffed, buffer);
    if (!dims || dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
      return NextResponse.json({ error: `Image dimensions too large: ${file.name}` }, { status: 413 });
    }

    const path = `trade-ins/${new Date().getFullYear()}/${sanitizeFilename(file.name)}-${randomId()}.${extForMime(sniffed)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: sniffed,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return NextResponse.json({ success: true, urls });
}
