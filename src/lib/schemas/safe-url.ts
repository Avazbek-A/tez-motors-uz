import { z } from "zod";

/**
 * A zod string validator that ONLY accepts http(s) URLs.
 *
 * `z.string().url()` is permissive: it returns true for `javascript:alert(1)`,
 * `data:text/html,<script>...`, `file:///etc/passwd`, and other dangerous
 * schemes (zod just delegates to `new URL(value)`). Image / video / cover
 * fields stored from admin write paths end up rendered into <img src>, <a href>,
 * and similar — `javascript:` URLs in an <a href> are a one-click DOM XSS, and
 * `data:` URLs can carry hostile payloads.
 *
 * Use this for any user-supplied (or admin-supplied) URL that the storefront
 * will render. The 2000-char cap matches the rest of the codebase's URL caps.
 */
export const safeHttpUrl = z
  .string()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "must be an http(s) URL");

/** Helper: nullable / optional safe URL (for cover_image, thumbnail, video_url). */
export const safeHttpUrlNullable = safeHttpUrl.optional().nullable();
