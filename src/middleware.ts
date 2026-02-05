import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (pathname.startsWith("/waiverdesk")) {
    if (pathname === "/waiverdesk" || pathname.startsWith("/waiverdesk/dashboard")) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const url = request.nextUrl.clone();
    const stripped = pathname.replace(/^\/waiverdesk/, "") || "/";
    url.pathname = stripped === "/" ? "/dashboard" : stripped;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
