import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const ADMIN_COOKIE = "admin_session";

/**
 * UX-level gate: redirect to login if no admin cookie is present.
 * Actual auth enforcement lives in API routes (requireAdmin), which
 * verifies the cookie against the admin_sessions table.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!cookie) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
