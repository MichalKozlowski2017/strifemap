import type { Locale } from "@/lib/i18n/dictionary";
import type { Confidence, IncidentType } from "@/lib/types";
import { t } from "@/lib/i18n/dictionary";

type LocalizedFields = {
  title?: string | null;
  summary?: string | null;
  title_pl?: string | null;
  title_en?: string | null;
  summary_pl?: string | null;
  summary_en?: string | null;
};

/** Prefer locale-specific fields; never fall back to the wrong language. */
export function localizedTitle(
  row: LocalizedFields,
  locale: Locale,
): string {
  if (locale === "pl") {
    return row.title_pl?.trim() || row.title?.trim() || "—";
  }
  return row.title_en?.trim() || "—";
}

export function localizedSummary(
  row: LocalizedFields,
  locale: Locale,
): string {
  if (locale === "pl") {
    return row.summary_pl?.trim() || row.summary?.trim() || "";
  }
  return row.summary_en?.trim() || "";
}

export function typeLabel(type: IncidentType, locale: Locale): string {
  return t(locale).type[type] ?? type;
}

export function confidenceLabel(
  confidence: Confidence,
  locale: Locale,
): string {
  return t(locale).confidence[confidence] ?? confidence;
}

export function theaterName(
  theater: { name_pl: string; name_en: string },
  locale: Locale,
): string {
  return locale === "en" ? theater.name_en : theater.name_pl;
}
