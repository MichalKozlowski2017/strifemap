import { formatTime } from "@/lib/dates";
import {
  localizedSummary,
  localizedTitle,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { newsCopy, type DayNewsCard } from "@/lib/news/items";
import { NewsImage } from "@/components/news/news-image";

/** Readable news front: lead with large image, then list. */
export function NewsFront({
  locale,
  items,
}: {
  locale: Locale;
  items: DayNewsCard[];
}) {
  const d = t(locale);

  if (items.length === 0) {
    return <p className="text-base text-[var(--muted)]">{d.newsEmpty}</p>;
  }

  const photoIdx = items.findIndex((i) => i.image_url);
  const ordered =
    photoIdx > 0
      ? [items[photoIdx], ...items.filter((_, i) => i !== photoIdx)]
      : items;
  const leadStory = ordered[0]!;
  const list = ordered.slice(1);

  return (
    <div className="space-y-10">
      <article className="border border-[var(--border)] bg-[var(--surface)]">
        <NewsImage
          src={leadStory.image_url}
          alt={localizedTitle(leadStory, locale)}
          aspect="wide"
          className="w-full"
        />
        <div className="space-y-3 p-4 md:p-6">
          <p className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">
            {formatTime(leadStory.occurred_at, locale)}
            <span className="mx-1.5">·</span>
            {leadStory.source_name}
            <span className="mx-1.5">·</span>
            {d.newsNotOnMap}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide text-[var(--foreground)] md:text-4xl">
            {localizedTitle(leadStory, locale)}
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
            {newsCopy(
              localizedSummary(leadStory, locale),
              leadStory.body,
              6,
              1_100,
            )}
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
            const copy = newsCopy(
              localizedSummary(item, locale),
              item.body,
              4,
              720,
            );
            return (
              <li key={item.id} className="py-5 first:pt-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
                  <NewsImage
                    src={item.image_url}
                    alt=""
                    aspect="video"
                    className="rounded-sm"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">
                      {formatTime(item.occurred_at, locale)}
                      <span className="mx-1.5">·</span>
                      {item.source_name}
                    </p>
                    <h3 className="mt-1 text-lg font-medium leading-snug text-[var(--foreground)] md:text-xl">
                      {title}
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
