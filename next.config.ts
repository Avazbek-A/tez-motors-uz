import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the file-tracing root to THIS project. Without it, a stray lockfile in a
// parent dir (e.g. ~/package-lock.json) makes Next infer the wrong workspace
// root and nest the standalone output under .next/standalone/<deep/path>/server.js
// — which breaks self-hosting (Docker / systemd / `npm run selfhost:start`).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  // Suppress the `X-Powered-By: Next.js` response header — small info-disclosure
  // hardening; tells less to fingerprinting scanners about our stack.
  poweredByHeader: false,
  images: {
    // Hero/car/blog images are immutable (named assets, replaced via new files
    // rather than mutated in place). Cache optimized variants for a year so the
    // browser + Next's on-disk image cache stop re-fetching and re-encoding them
    // every few hours (the default minimumCacheTTL was 4h → constant re-optimize
    // on a CDN that doesn't cache the query-string optimizer URL).
    minimumCacheTTL: 31536000,
    // No surface on this site renders an image wider than a full-bleed ~1920px
    // hero, but Next defaults to offering 2048 + 3840 variants too. Since the
    // image optimizer isn't CDN-cached (Cloudflare bypasses the query-string
    // /_next/image URL), every offered width is a wasted cold sharp-encode on the
    // single self-hosted box. Cap at 1920: smaller srcset markup + no 2K/4K encodes.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        // Wikimedia Commons — used for seeded car photos until the
        // dealer uploads their own. CC0 / CC-BY licensed.
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  output: "standalone",
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https://*.autohome.com.cn",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
      "frame-src 'self' https://yandex.com https://yandex.ru https://*.yandex.net https://*.maps.yandex.net https://challenges.cloudflare.com https://pano.autohome.com.cn",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
      // Collect violations so we can safely flip Report-Only → enforced once prod is clean.
      "report-uri /api/csp-report",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Allow same-origin pages to REQUEST mic/camera (the Calls suite's call
          // recorder, voice-clone trainer, CV greeter + trade-in scanner). `(self)`
          // is a capability only — the browser still prompts the user per use; it
          // does NOT auto-grant. `()` here previously blocked recording site-wide.
          // geolocation stays fully blocked (no feature needs it).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Report-only to start — flip to Content-Security-Policy after observing prod for violations.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
      // Static image assets in /public/images are immutable (we replace by
      // shipping a new file, never mutating an existing one). Cache hard at the
      // browser AND the CDN — unlike the query-string /_next/image optimizer URL,
      // Cloudflare caches these extension-based static paths, so this turns
      // repeat hero/car-photo loads into edge HITs instead of origin fetches.
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Cookie-gated routes should NEVER be cached by intermediate proxies or
      // a misconfigured CDN. Routes can still set their own Cache-Control if
      // they intentionally want public caching (e.g. /api/cars list which uses
      // s-maxage in-route — those headers come from the route response and
      // override this global default).
      {
        source: "/api/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/account/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/payments/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
