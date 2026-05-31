/**
 * Web Push (RFC 8030 / 8291 / 8292) implemented entirely on the Web Crypto API
 * so it runs on Cloudflare Workers with NO npm dependency (no `web-push`, which
 * pulls in node crypto + https).
 *
 * Two crypto pieces:
 *   1. VAPID JWT (RFC 8292) — an ES256 token identifying our server, signed with
 *      the VAPID private key (a P-256 scalar). Sent as `Authorization: vapid`.
 *   2. Payload encryption (RFC 8291, aes128gcm) — ECDH against the subscriber's
 *      p256dh key + their auth secret, HKDF to a content key + nonce, AES-128-GCM.
 *
 * Fail-open: if VAPID keys are unset, sendPush no-ops. Dead endpoints (404/410)
 * are pruned from push_subscriptions so a bulk send doesn't keep hammering them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "./error-report";

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// ---- base64url helpers -----------------------------------------------------
function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    "=",
  );
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ---- VAPID JWT (ES256) -----------------------------------------------------
async function importVapidSigningKey(): Promise<CryptoKey | null> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  const pubBytes = b64urlToBytes(pub); // 65 bytes: 0x04 || x(32) || y(32)
  if (pubBytes.length !== 65) return null;
  const x = bytesToB64url(pubBytes.slice(1, 33));
  const y = bytesToB64url(pubBytes.slice(33, 65));
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d: priv,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}

async function buildVapidAuth(endpoint: string): Promise<{ jwt: string; key: string } | null> {
  const signingKey = await importVapidSigningKey();
  if (!signingKey) return null;
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    utf8(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: process.env.VAPID_SUBJECT || "mailto:admin@tezmotors.uz",
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      utf8(signingInput) as unknown as BufferSource,
    ),
  );
  const jwt = `${signingInput}.${bytesToB64url(sig)}`;
  return { jwt, key: process.env.VAPID_PUBLIC_KEY as string };
}

// ---- aes128gcm payload encryption (RFC 8291) -------------------------------
async function hkdf(
  ikm: Uint8Array | CryptoKey,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key =
    ikm instanceof Uint8Array
      ? await crypto.subtle.importKey("raw", ikm as unknown as BufferSource, "HKDF", false, [
          "deriveBits",
        ])
      : ikm;
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      info: info as unknown as BufferSource,
    },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  payload: Uint8Array,
  uaPublic: Uint8Array,
  authSecret: Uint8Array,
): Promise<{ body: Uint8Array }> {
  // Ephemeral server ECDH keypair.
  const asKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublic as unknown as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256),
  );

  // Step 1: combine ECDH secret with the auth secret (salt = auth secret).
  const keyInfo = concat(utf8("WebPush: info\0"), uaPublic, asPublicRaw);
  const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32);

  // Step 2: derive content-encryption key + nonce (salt = 16 random bytes).
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, utf8("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as unknown as BufferSource,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  // Single record: plaintext || 0x02 delimiter (no further padding).
  const plaintext = concat(payload, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as unknown as BufferSource, tagLength: 128 },
      aesKey,
      plaintext as unknown as BufferSource,
    ),
  );

  // aes128gcm header: salt(16) || rs(uint32be) || idlen(uint8) || as_public(65).
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([asPublicRaw.length]);
  const body = concat(salt, rs, idlen, asPublicRaw, ciphertext);
  return { body };
}

/**
 * Send one push. Returns "ok" | "gone" | "fail". "gone" means the endpoint is
 * dead and should be pruned (handled by sendPushToMany).
 */
async function sendOne(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<"ok" | "gone" | "fail"> {
  const vapid = await buildVapidAuth(sub.endpoint);
  if (!vapid) return "fail"; // keys unset → fail-open (no-op)

  try {
    const { body } = await encryptPayload(
      utf8(JSON.stringify(payload)),
      b64urlToBytes(sub.p256dh),
      b64urlToBytes(sub.auth),
    );
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: `vapid t=${vapid.jwt}, k=${vapid.key}`,
      },
      body: body as unknown as BodyInit,
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) return "fail";
    return "ok";
  } catch {
    return "fail";
  }
}

/**
 * Fan out a push to many subscriptions, pruning dead endpoints. Capped per call
 * (MAX_FANOUT) so a bulk price edit can't storm. Fail-open throughout.
 */
const MAX_FANOUT = 500;

export async function sendPushToMany(
  supabase: SupabaseClient,
  subs: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!process.env.VAPID_PRIVATE_KEY) return { sent: 0, pruned: 0 };
  let sent = 0;
  const dead: string[] = [];
  for (const sub of subs.slice(0, MAX_FANOUT)) {
    const result = await sendOne(sub, payload);
    if (result === "ok") sent += 1;
    else if (result === "gone") dead.push(sub.id);
  }
  if (dead.length > 0) {
    try {
      await supabase.from("push_subscriptions").delete().in("id", dead);
    } catch {
      // ignore prune failures
    }
  }
  if (sent > 0 || dead.length > 0) {
    logEvent("push.fanout", { sent, pruned: dead.length });
  }
  return { sent, pruned: dead.length };
}
