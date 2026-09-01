// Renamed from middleware.ts (Next.js 16). Must live at src/proxy.ts, a sibling of src/app - Next.js won't recognize it elsewhere.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Checks the cookie, not localStorage - middleware runs on the server, which has no access to localStorage.
  const isLoggedIn = Boolean(request.cookies.get("token")?.value);

  if (!isLoggedIn && request.nextUrl.pathname.startsWith("/docs")) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/docs/:path*"],
};
