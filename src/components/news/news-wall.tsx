import Link from "next/link";
import { NewsImage } from "@/components/news/news-image";
import { localizedTitle } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { DayNewsCard } from "@/lib/news/items";

/** Day news wall — image, title, source; links to /news. */
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
  const href = `/news?date=${date}`;
  const shown = items.slice(0, 8);

  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--accent)] md:text-2xl">
          {d.newsWall}
        </h2>
        <Link
          href={href}
          className="text-[11px] uppercase tracking-wider text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {d.newsOpenDay}
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{d.newsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <li key={item.id}>
              <Link
                href={href}
                className="group grid grid-cols-[4.5rem_1fr] gap-3 border border-[var(--border)] bg-[var(--surface)] p-2 transition hover:border-[var(--border-strong)]"
              >
                <NewsImage
                  src={item.image_url}
                  alt=""
                  aspect="square"
                  className="rounded-sm"
                />
                <div className="min-w-0 self-center">
                  <p className="truncate text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                    {item.source_name}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-sm font-medium leading-snug text-[var(--foreground)] group-hover:text-[var(--accent)]">
                    {localizedTitle(item, locale)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
