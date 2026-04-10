import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Forwards the current pathname (+ search) to server components via the
// x-pathname request header. Server components read it to build a
// callbackUrl when they need to redirect unauthenticated users to sign in.
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    request.nextUrl.pathname + request.nextUrl.search
  );
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Run on every page route; skip static assets, images, and the NextAuth
    // API so we don't loop sign-in redirects through the middleware.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml).*)",
  ],
};
