// proxy.ts (formerly middleware.ts, renamed by Next.js 16 - see
// https://nextjs.org/docs/messages/middleware-to-proxy)
//
// Must live at src/proxy.ts (a sibling of src/app), not inside src/app -
// Next.js only recognizes the file at the project/src root. It previously
// lived at src/app/middleware.ts, so it was silently never loaded at all.
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
