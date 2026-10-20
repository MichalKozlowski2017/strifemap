import { NextRequest, NextResponse } from "next/server";
import {
  PANEL_COOKIE,
  createPanelSessionToken,
  isPanelPasswordConfigured,
  panelCookieMaxAge,
  panelCookieOptions,
  verifyPanelPassword,
} from "@/lib/auth/panel-edge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isPanelPasswordConfigured()) {
    return NextResponse.json(
      { error: "PANEL_PASSWORD not configured" },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let password = "";
  let nextRaw: string | null = null;
  let viaForm = false;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      password?: string;
      next?: string;
    };
    password = String(body.password ?? "");
    nextRaw = body.next ?? null;
  } else {
    viaForm = true;
    const form = await request.formData();
    password = String(form.get("password") ?? "");
    nextRaw = form.get("next") ? String(form.get("next")) : null;
  }

  if (!(await verifyPanelPassword(password))) {
    if (viaForm) {
      const url = new URL("/panel/login", request.url);
      url.searchParams.set("error", "1");
      if (nextRaw) url.searchParams.set("next", safeNext(nextRaw));
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createPanelSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Session failed" }, { status: 500 });
  }

  const nextPath = safeNext(nextRaw);
  const res = viaForm
    ? NextResponse.redirect(new URL(nextPath, request.url), 303)
    : NextResponse.json({ ok: true, next: nextPath });

  res.cookies.set(
    PANEL_COOKIE,
    token,
    panelCookieOptions(panelCookieMaxAge()),
  );
  return res;
}

function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/panel";
  if (raw.startsWith("/panel/login")) return "/panel";
  return raw;
}
