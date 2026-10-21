"use client";

import Link from "next/link";
import { NewsImage } from "@/components/news/news-image";
import { localizedTitle } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { countryDisplayName } from "@/lib/geo/country-names";
import { formatDisplayDate } from "@/lib/dates";
import {
  articleSummaryForLocale,
  type DayNewsCard,
} from "@/lib/news/items";

/** Country rail: header + news only (incidents live in the main column). */
export function CountryCard({
  locale,
  date,
  iso,
  nameEn,
  news,
  onClear,
}: {
  locale: Locale;
  date: string;
  iso: string;
  nameEn?: string | null;
  news: DayNewsCard[];
  onClear: () => void;
}) {
  const d = t(locale);
  const name = countryDisplayName(iso, locale, nameEn);

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
          <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">
            {formatDisplayDate(date, locale)}
          </p>
        </div>
        <button
          type="button"
          data-wn-clear-country
          onClick={onClear}
          className="min-h-10 shrink-0 text-[11px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--accent)]"
        >
          {d.clearCountry}
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {news.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{d.newsEmpty}</p>
        ) : (
          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
              {d.news}
            </h3>
            <ul className="mt-2 space-y-4">
              {news.map((item) => {
                const title = localizedTitle(item, locale);
                const articleHref = `/news/${item.id}?date=${date}`;
                const copy = articleSummaryForLocale(item, locale);
                return (
                  <li key={item.id}>
                    <div className="grid grid-cols-[4.5rem_1fr] gap-3">
                      <Link href={articleHref} className="block overflow-hidden">
                        <NewsImage
                          src={item.image_url}
                          alt={title}
                          aspect="square"
                          className="rounded-sm"
                          required
                        />
                      </Link>
                      <div className="min-w-0">
                        <p className="truncate text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                          {item.source_name}
                        </p>
                        <Link href={articleHref} className="mt-0.5 block">
                          <span className="line-clamp-3 text-sm font-medium leading-snug text-[var(--foreground)] hover:text-[var(--accent)]">
                            {title}
                          </span>
                        </Link>
                        {copy ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                            {copy}
                          </p>
                        ) : null}
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex min-h-9 items-center text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
                          >
                            {d.newsReadSource}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
