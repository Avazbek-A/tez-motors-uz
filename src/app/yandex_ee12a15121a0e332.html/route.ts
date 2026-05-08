/**
 * Yandex Webmaster ownership verification.
 *
 * Yandex requires the file at the literal `/yandex_<id>.html` URL with
 * an exact body. Serving this via an app route (rather than a static
 * file in `public/`) sidesteps Next.js's automatic .html-stripping
 * redirect, which would break Yandex's verification crawl.
 */
export const runtime = "nodejs";

const BODY = `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: ee12a15121a0e332</body>
</html>
`;

export async function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
