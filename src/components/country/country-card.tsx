"use client";

import Link from "next/link";
import {
  localizedTitle,
  typeLabel,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { countryDisplayName } from "@/lib/geo/country-names";
import { formatTime } from "@/lib/dates";
import {
  articleSummaryForLocale,
  type DayNewsCard,
} from "@/lib/news/items";
import type { DayIncidentCard } from "@/components/day/day-reader";

export function CountryCard({
  locale,
  date,
  iso,
  nameEn,
  incidents,
  news,
  onClear,
  onSelectIncident,
}: {
  locale: Locale;
  date: string;
  iso: string;
  nameEn?: string | null;
  incidents: DayIncidentCard[];
  news: DayNewsCard[];
  onClear: () => void;
  onSelectIncident?: (id: string) => void;
}) {
  const d = t(locale);
  const name = countryDisplayName(iso, locale, nameEn);
  const hasSignals = incidents.length > 0 || news.length > 0;

  const note = (() => {
    if (!hasSignals) return null;
    const bits: string[] = [];
    if (incidents.length) {
      bits.push(
        locale === "pl"
          ? `${incidents.length === 1 ? "1 incydent" : `${incidents.length} incydentów`} na mapie`
          : `${incidents.length} mapped incident${incidents.length === 1 ? "" : "s"}`,
      );
    }
    if (news.length) {
      bits.push(
        locale === "pl"
          ? `${news.length === 1 ? "1 wiadomość" : `${news.length} wiadomości`} poza mapą`
          : `${news.length} off-map news item${news.length === 1 ? "" : "s"}`,
      );
    }
    const top = [
      ...incidents.slice(0, 2).map((i) => localizedTitle(i, locale)),
      ...news.slice(0, 1).map((n) => localizedTitle(n, locale)),
    ].filter(Boolean);
    return `${bits.join(" · ")}. ${top.join(" · ")}`;
  })();

  return (
    <aside className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">
            {iso}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--foreground)] md:text-2xl">
            {name}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">{date}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="min-h-10 shrink-0 text-[11px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--accent)]"
        >
          {d.clearCountry}
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        {!hasSignals ? (
          <p className="text-sm text-[var(--muted)]">{d.countryEmpty}</p>
        ) : (
          <>
            {note ? (
              <p className="text-sm leading-relaxed text-[var(--muted)]">{note}</p>
            ) : null}

            {incidents.length > 0 ? (
              <section>
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
                  {d.incidents}
                </h3>
                <ul className="mt-2 space-y-2">
                  {incidents.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelectIncident?.(item.id)}
                        className="w-full text-left"
                      >
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
                          {formatTime(item.occurred_at, locale)} ·{" "}
                          {typeLabel(item.type, locale)}
                        </p>
                        <p className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
                          {localizedTitle(item, locale)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {news.length > 0 ? (
              <section>
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
                  {d.news}
                </h3>
                <ul className="mt-2 space-y-3">
                  {news.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/news/${item.id}?date=${date}`}
                        className="block"
                      >
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
                          {item.source_name}
                        </p>
                        <p className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
                          {localizedTitle(item, locale)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                          {articleSummaryForLocale(item, locale)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
