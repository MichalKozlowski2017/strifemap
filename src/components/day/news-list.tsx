import { formatTime } from "@/lib/dates";
import {
  localizedSummary,
  localizedTitle,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { twoSentences, type DayNewsCard } from "@/lib/news/items";

export function NewsList({
  locale,
  items,
}: {
  locale: Locale;
  items: DayNewsCard[];
}) {
  const d = t(locale);

  return (
    <section className="mt-12 border-t border-white/10 pt-10">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
          {d.news}
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-stone-500">
          {d.newsNotOnMap}
        </span>
      </div>
      <p className="mb-5 max-w-2xl text-sm text-stone-500">{d.newsHint}</p>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500">{d.newsEmpty}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const title = localizedTitle(item, locale);
            const summary = twoSentences(localizedSummary(item, locale));
            return (
              <li
                key={item.id}
                className="border-b border-white/5 pb-4 last:border-0 last:pb-0"
              >
                <p className="text-[10px] uppercase tracking-widest text-stone-500">
                  {formatTime(item.occurred_at, locale)}
                  <span className="mx-1.5 text-stone-600">·</span>
                  {item.source_name}
                </p>
                <p className="mt-1 font-medium text-stone-100">{title}</p>
                {summary ? (
                  <p className="mt-1 text-sm leading-relaxed text-stone-400">
                    {summary}
                  </p>
                ) : null}
                {item.source_url ? (
                  <p className="mt-2">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#c4a35a] underline-offset-2 hover:underline"
                    >
                      {d.newsReadSource}
                    </a>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
