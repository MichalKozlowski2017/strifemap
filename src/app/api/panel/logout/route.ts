import { NextRequest, NextResponse } from "next/server";
import { PANEL_COOKIE, panelCookieOptions } from "@/lib/auth/panel-edge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/panel/login", request.url), 303);
  res.cookies.set(PANEL_COOKIE, "", { ...panelCookieOptions(0), maxAge: 0 });
  return res;
}
