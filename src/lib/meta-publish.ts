/**
 * Meta (Facebook Page + Instagram) publishing via the Graph API (Phase AJ).
 *
 * The content studio already drafts instagram/facebook posts but the poster only
 * sent them to Telegram. This adds real publishing: a Facebook Page feed post
 * (single call) and an Instagram image post (two-step create-container →
 * publish, which is how the IG Graph API works). Env-gated + fail-open — absent
 * creds simply return { ok:false } and the caller falls back to Telegram.
 *
 * Workers-safe: plain HTTPS fetch, no node-only deps.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export function metaConfigured(): { fb: boolean; ig: boolean } {
  const hasToken = !!process.env.META_PAGE_TOKEN;
  return {
    fb: hasToken && !!process.env.META_PAGE_ID,
    ig: hasToken && !!process.env.IG_BUSINESS_ID,
  };
}

export async function postToFacebook(message: string, linkUrl?: string): Promise<{ ok: boolean }> {
  const token = process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId || !message.trim()) return { ok: false };
  try {
    const body = new URLSearchParams({ message: message.slice(0, 5000), access_token: token });
    if (linkUrl) body.set("link", linkUrl);
    const res = await fetch(`${GRAPH}/${pageId}/feed`, { method: "POST", body });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function postToInstagram(imageUrl: string, caption: string): Promise<{ ok: boolean }> {
  const token = process.env.META_PAGE_TOKEN;
  const ig = process.env.IG_BUSINESS_ID;
  if (!token || !ig || !imageUrl) return { ok: false };
  try {
    // 1) Create the media container.
    const create = new URLSearchParams({
      image_url: imageUrl,
      caption: caption.slice(0, 2200),
      access_token: token,
    });
    const cRes = await fetch(`${GRAPH}/${ig}/media`, { method: "POST", body: create });
    if (!cRes.ok) return { ok: false };
    const cJson = (await cRes.json().catch(() => null)) as { id?: string } | null;
    if (!cJson?.id) return { ok: false };
    // 2) Publish it.
    const pub = new URLSearchParams({ creation_id: cJson.id, access_token: token });
    const pRes = await fetch(`${GRAPH}/${ig}/media_publish`, { method: "POST", body: pub });
    return { ok: pRes.ok };
  } catch {
    return { ok: false };
  }
}
