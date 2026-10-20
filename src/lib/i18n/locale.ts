import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/dictionary";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "pl";
}

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value);
}
