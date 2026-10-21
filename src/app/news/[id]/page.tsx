import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsImage } from "@/components/news/news-image";
import { SiteHeader } from "@/components/site-header";
import { formatTime, parseDateISO, todayISO } from "@/lib/dates";
import { listTheaters } from "@/lib/db/queries";
import { localizedTitle } from "@/lib/i18n/content";
import { t } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";
import {
  articleSummaryForLocale,
  getNewsArticleById,
} from "@/lib/news/items";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const d = t(locale);
  const theaters = await listTheaters();
  const item = await getNewsArticleById(id);
  if (!item || !item.image_url) notFound();

  const dayParam =
    sp.date && parseDateISO(sp.date)
      ? sp.date
      : item.occurred_at.slice(0, 10) || todayISO();
  const summary = articleSummaryForLocale(item, locale);
  const title = localizedTitle(item, locale);

  return (
    <main className="min-h-screen bg-[var(--background)] pb-16">
      <SiteHeader
        theaters={theaters}
        locale={locale}
        date={dayParam}
        activeNav="news"
      />
      <article className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        <p className="mb-4">
          <Link
            href={`/news?date=${dayParam}`}
            className="text-[11px] uppercase tracking-widest text-[var(--accent)] hover:underline"
          >
            {d.backToNews}
          </Link>
        </p>

        <NewsImage
          src={item.image_url}
          alt={title}
          aspect="wide"
          className="w-full border border-[var(--border)]"
          required
        />

        <header className="mt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">
            {formatTime(item.occurred_at, locale)}
            <span className="mx-1.5">·</span>
            {item.source_name}
            <span className="mx-1.5">·</span>
            {d.newsNotOnMap}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-wide text-[var(--foreground)] md:text-4xl">
            {title}
          </h1>
        </header>

        {summary ? (
          <p className="mt-5 text-base leading-relaxed text-[var(--muted)] md:text-lg">
            {summary}
          </p>
        ) : null}

        {item.source_url ? (
          <p className="mt-8">
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center border border-[var(--border-strong)] px-4 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              {d.newsReadSource} ({item.source_name})
            </a>
          </p>
        ) : null}
      </article>
    </main>
  );
}
