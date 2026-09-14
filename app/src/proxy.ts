
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {

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
