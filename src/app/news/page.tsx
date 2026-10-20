import { NewsFront } from "@/components/news/news-front";
import { SiteHeader } from "@/components/site-header";
import { parseDateISO, todayISO } from "@/lib/dates";
import { getLatestMapDate } from "@/lib/geo/incidents";
import { listTheaters } from "@/lib/db/queries";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/dictionary";
import { getNewsForDay } from "@/lib/news/items";
import { formatDisplayDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const d = t(locale);
  const theaters = await listTheaters();

  const requested =
    params.date && parseDateISO(params.date) ? params.date : null;
  const date = requested ?? (await getLatestMapDate()) ?? todayISO();
  const items = await getNewsForDay({ date });

  return (
    <main className="min-h-screen pb-16">
      <div className="wn-scanline" aria-hidden />
      <SiteHeader
        theaters={theaters}
        locale={locale}
        date={date}
        activeNav="news"
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <header className="mb-8 max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#c4a35a]">
            {d.newsNotOnMap}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[#f3efe6] md:text-5xl">
            {d.news}
          </h1>
          <p className="mt-2 text-sm text-stone-400 md:text-base">
            {formatDisplayDate(date, locale)}
            <span className="mx-2 text-stone-600">·</span>
            {d.newsHint}
          </p>
        </header>
        <NewsFront locale={locale} items={items} />
      </div>
    </main>
  );
}
