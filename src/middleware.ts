import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { detectBestLocale, getLocaleFromPathname } from "@/lib/locale-path";
const ADMIN_COOKIE = "admin_session";
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * UX-level gate: redirect to login if no admin cookie is present.
 * Actual auth enforcement lives in API routes (requireAdmin), which
 * verifies the cookie against the admin_sessions table.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/images")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!cookie) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const localeFromPath = getLocaleFromPathname(pathname);
  if (localeFromPath) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tez-locale", localeFromPath);
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.cookies.set(LOCALE_COOKIE, localeFromPath, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  if (pathname === "/") {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const bestLocale = (cookieLocale === "ru" || cookieLocale === "uz" || cookieLocale === "en")
      ? cookieLocale
      : detectBestLocale(request.headers.get("accept-language"));
    const url = new URL(`/${bestLocale}`, request.url);
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith("/admin")) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const bestLocale = (cookieLocale === "ru" || cookieLocale === "uz" || cookieLocale === "en")
      ? cookieLocale
      : detectBestLocale(request.headers.get("accept-language"));
    const response = NextResponse.redirect(new URL(`/${bestLocale}${pathname}`, request.url));
    response.cookies.set(LOCALE_COOKIE, bestLocale ?? defaultLocale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  runtime: "experimental-edge",
  // Bypass middleware for root-level files that must NOT be redirected
  // to a locale-prefixed path: API, Next assets, favicons, images,
  // robots/sitemap/llms (search-engine + AI-crawler files), the PWA
  // manifest, and the OG image.
  // Bypass middleware for root-level files that must NOT be redirected
  // to a locale-prefixed path: API, Next assets, favicons, images,
  // robots/sitemap/llms (search-engine + AI-crawler files), the PWA
  // manifest, the OG image, and the search-engine verification files
  // (Yandex / Google / Bing all want a static file at the bare root).
  matcher: [
    "/((?!api|_next|favicon\\.ico|images|robots\\.txt|sitemap\\.xml|llms\\.txt|manifest\\.webmanifest|opengraph-image|yandex_|google[a-f0-9]+\\.html|BingSiteAuth\\.xml|pinterest-).*)",
  ],
};
