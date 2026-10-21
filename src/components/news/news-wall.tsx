import Link from "next/link";
import { NewsImage } from "@/components/news/news-image";
import { localizedTitle } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import {
  articleSummaryForLocale,
  type DayNewsCard,
} from "@/lib/news/items";

/** Day news wall — real images only; thumb/title → article, separate source link. */
export function NewsWall({
  locale,
  date,
  items,
  className = "",
}: {
  locale: Locale;
  date: string;
  items: DayNewsCard[];
  className?: string;
}) {
  const d = t(locale);
  const dayHref = `/news?date=${date}`;
  const shown = items.slice(0, 8);

  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--accent)] md:text-2xl">
          {d.newsWall}
        </h2>
        <Link
          href={dayHref}
          className="text-[11px] uppercase tracking-wider text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {d.newsOpenDay}
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{d.newsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => {
            const articleHref = `/news/${item.id}?date=${date}`;
            const title = localizedTitle(item, locale);
            const copy = articleSummaryForLocale(item, locale);
            return (
              <li
                key={item.id}
                className="border border-[var(--border)] bg-[var(--surface)] p-2"
              >
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
                  <div className="min-w-0 self-center">
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
      )}
    </section>
  );
}
