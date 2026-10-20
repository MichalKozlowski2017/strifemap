import Link from "next/link";
import { localizedTitle } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { newsTeaserCopy, type DayNewsCard } from "@/lib/news/items";
import { NewsImage } from "@/components/news/news-image";

/** Short home/theater teaser — links to the full day news page. */
export function NewsTeaser({
  locale,
  date,
  items,
}: {
  locale: Locale;
  date: string;
  items: DayNewsCard[];
}) {
  const d = t(locale);
  const href = `/news?date=${date}`;
  const lead = items[0] ?? null;
  const more = Math.max(0, items.length - 1);

  return (
    <section className="mt-12 border-t border-white/10 pt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
            {d.news}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{d.newsHint}</p>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center px-3 text-sm text-[#c4a35a] underline-offset-2 hover:underline"
        >
          {d.newsOpenDay}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500">{d.newsEmpty}</p>
      ) : lead ? (
        <Link
          href={href}
          className="group grid gap-4 border border-white/10 bg-black/20 p-3 transition hover:border-white/25 sm:grid-cols-[minmax(0,14rem)_1fr] sm:p-4"
        >
          <NewsImage
            src={lead.image_url}
            alt=""
            className="rounded-sm"
            aspect="video"
          />
          <div className="min-w-0 self-center">
            <p className="text-[10px] uppercase tracking-widest text-stone-500">
              {lead.source_name}
              <span className="mx-1.5 text-stone-600">·</span>
              {d.newsNotOnMap}
            </p>
            <p className="mt-1 text-lg font-medium leading-snug text-stone-100 group-hover:text-[#f3efe6]">
              {localizedTitle(lead, locale)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              {newsTeaserCopy(
                locale === "pl"
                  ? lead.summary_pl || lead.summary || ""
                  : lead.summary_en || lead.summary || "",
                lead.body,
              )}
            </p>
            {more > 0 ? (
              <p className="mt-3 text-xs text-[#c4a35a]">
                {locale === "pl"
                  ? `+${more} kolejnych w Wiadomościach`
                  : `+${more} more in News`}
              </p>
            ) : null}
          </div>
        </Link>
      ) : null}
    </section>
  );
}
