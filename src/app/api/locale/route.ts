import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/dictionary";
import { parseLocale } from "@/lib/i18n/locale";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale: Locale = parseLocale(body.locale);
  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
