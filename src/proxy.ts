import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionOk } from "@/lib/passcode";

// Everything except the login page and static assets requires the session cookie.
export function proxy(request: NextRequest) {
  if (sessionOk(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon|icon|apple-touch-icon|manifest|robots).*)"],
};
