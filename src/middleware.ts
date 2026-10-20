import { NextRequest, NextResponse } from "next/server";
import {
  PANEL_COOKIE,
  verifyPanelSessionToken,
} from "@/lib/auth/panel-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/panel/login" ||
    pathname.startsWith("/api/panel/login") ||
    pathname.startsWith("/api/panel/logout")
  ) {
    return NextResponse.next();
  }

  const needsAuth =
    pathname === "/panel" ||
    pathname.startsWith("/panel/") ||
    pathname === "/api/panel" ||
    pathname.startsWith("/api/panel/");

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(PANEL_COOKIE)?.value;
  if (await verifyPanelSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/panel/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/api/panel", "/api/panel/:path*"],
};
