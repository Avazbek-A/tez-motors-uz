/**
 * Yandex Webmaster ownership verification.
 *
 * Yandex requires the file at the literal `/yandex_<id>.html` URL.
 * Served via an app route (not public/) so we bypass Next.js's
 * automatic .html → no-extension redirect.
 *
 * Strict body match: no trailing newline, exact indentation as
 * provided by the Yandex Webmaster UI. no-store cache headers so
 * Yandex always re-fetches a fresh copy on retry.
 */
export const runtime = "nodejs";

const BODY = `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: ee12a15121a0e332</body>
</html>`;

export async function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-robots-tag": "noindex",
      // Override Next.js's default Vary on RSC fields — Yandex's
      // verification bot apparently caches per-Vary and the RSC vary
      // values on first hit are not what subsequent fetches send.
      vary: "Accept",
      // Force a non-RSC content shape so OpenNext doesn't tack on
      // server-component metadata.
      "x-no-rsc": "1",
    },
  });
}
