import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin auth: simple password-based protection
  // In production, replace with Supabase Auth
  if (pathname.startsWith("/admin")) {
    const adminAuth = request.cookies.get("admin_auth")?.value;

    if (adminAuth !== "tez-motors-admin-2024") {
      // Check for auth header (for API access)
      const authHeader = request.headers.get("authorization");
      if (authHeader === "Bearer tez-motors-admin-2024") {
        return NextResponse.next();
      }

      // Redirect to admin login
      if (pathname !== "/admin/login") {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
