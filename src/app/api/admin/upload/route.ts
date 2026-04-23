import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 8000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_BUCKETS = new Set(["car-images", "part-images"]);
const DEFAULT_BUCKET = "car-images";

function pickBucket(value: FormDataEntryValue | null | undefined, fallback = DEFAULT_BUCKET): string {
  if (typeof value === "string" && ALLOWED_BUCKETS.has(value)) return value;
  return fallback;
}

function sanitizeFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 40) || "image";
}

// Magic-byte signatures to sniff actual MIME, don't trust Content-Type.
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    return null;
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const b1 = bytes[21];
    const b2 = bytes[22];
    const b3 = bytes[23];
    const b4 = bytes[24];
    const width = 1 + (((b2 & 0x3F) << 8) | b1);
    const height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
    return { width, height };
  }
  return null;
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  return {
    width: (((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0),
    height: (((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0),
  };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = bytes[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = readUInt16BE(bytes, offset + 2);
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xc3 ||
      marker >= 0xc5 &&
      marker <= 0xc7 ||
      marker >= 0xc9 &&
      marker <= 0xcb ||
      marker >= 0xcd &&
      marker <= 0xcf;
    if (isSof && offset + 7 < bytes.length) {
      const height = readUInt16BE(bytes, offset + 5);
      const width = readUInt16BE(bytes, offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function readImageDimensions(mime: string, bytes: Uint8Array): { width: number; height: number } | null {
  if (mime === "image/png") return readPngDimensions(bytes);
  if (mime === "image/jpeg") return readJpegDimensions(bytes);
  if (mime === "image/webp") return readWebpDimensions(bytes);
  return null;
}

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "webp";
}

function randomId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMime(buffer);
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
    return NextResponse.json({ error: "File content does not match an allowed image type" }, { status: 415 });
  }

  const dimensions = readImageDimensions(sniffed, buffer);
  if (!dimensions || dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    return NextResponse.json(
      { error: `Image dimensions too large (max ${MAX_DIMENSION}px)` },
      { status: 413 },
    );
  }

  const ext = extForMime(sniffed);
  const safeName = sanitizeFilename(file.name);
  const path = `${new Date().getFullYear()}/${safeName}-${randomId()}.${ext}`;
  const bucket = pickBucket(form.get("bucket"));

  const supabase = createServiceClient();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: sniffed,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ success: true, url: data.publicUrl, path, bucket });
}

export async function DELETE(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const body = await request.json().catch(() => ({}));
  const path = body?.path;
  const requestedBucket = typeof body?.bucket === "string" ? body.bucket : DEFAULT_BUCKET;
  const bucket = ALLOWED_BUCKETS.has(requestedBucket) ? requestedBucket : DEFAULT_BUCKET;
  if (!path || typeof path !== "string" || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
