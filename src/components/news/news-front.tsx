import Link from "next/link";
import { formatTime } from "@/lib/dates";
import {
  localizedSummary,
  localizedTitle,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import {
  articleSummaryForLocale,
  type DayNewsCard,
} from "@/lib/news/items";
import { NewsImage } from "@/components/news/news-image";

/** Day news front: lead + list. Thumb/title → article; separate source link. */
export function NewsFront({
  locale,
  date,
  items,
}: {
  locale: Locale;
  date: string;
  items: DayNewsCard[];
}) {
  const d = t(locale);

  if (items.length === 0) {
    return <p className="text-base text-[var(--muted)]">{d.newsEmpty}</p>;
  }

  const [leadStory, ...list] = items;

  return (
    <div className="space-y-10">
      <article className="border border-[var(--border)] bg-[var(--surface)]">
        <Link href={`/news/${leadStory.id}?date=${date}`} className="block">
          <NewsImage
            src={leadStory.image_url}
            alt={localizedTitle(leadStory, locale)}
            aspect="wide"
            className="w-full"
            required
          />
        </Link>
        <div className="space-y-3 p-4 md:p-6">
          <p className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">
            {formatTime(leadStory.occurred_at, locale)}
            <span className="mx-1.5">·</span>
            {leadStory.source_name}
            <span className="mx-1.5">·</span>
            {d.newsNotOnMap}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide text-[var(--foreground)] md:text-4xl">
            <Link
              href={`/news/${leadStory.id}?date=${date}`}
              className="hover:text-[var(--accent)]"
            >
              {localizedTitle(leadStory, locale)}
            </Link>
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
            {articleSummaryForLocale(leadStory, locale) ||
              localizedSummary(leadStory, locale)}
          </p>
          {leadStory.source_url ? (
            <a
              href={leadStory.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm text-[var(--accent)] underline-offset-2 hover:underline"
            >
              {d.newsReadSource}
            </a>
          ) : null}
        </div>
      </article>

      {list.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {list.map((item) => {
            const title = localizedTitle(item, locale);
            const articleHref = `/news/${item.id}?date=${date}`;
            const copy = articleSummaryForLocale(item, locale);
            return (
              <li key={item.id} className="py-5 first:pt-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
                  <Link href={articleHref} className="block overflow-hidden">
                    <NewsImage
                      src={item.image_url}
                      alt={title}
                      aspect="video"
                      className="rounded-sm"
                      required
                    />
                  </Link>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">
                      {formatTime(item.occurred_at, locale)}
                      <span className="mx-1.5">·</span>
                      {item.source_name}
                    </p>
                    <h3 className="mt-1 text-lg font-medium leading-snug md:text-xl">
                      <Link
                        href={articleHref}
                        className="text-[var(--foreground)] hover:text-[var(--accent)]"
                      >
                        {title}
                      </Link>
                    </h3>
                    {copy ? (
                      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">
                        {copy}
                      </p>
                    ) : null}
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex min-h-11 items-center text-sm text-[var(--accent)] underline-offset-2 hover:underline"
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
      ) : null}
    </div>
  );
}
