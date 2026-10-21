import { notFound } from "next/navigation";
import { MapShell } from "@/components/map/map-shell";
import { SiteHeader } from "@/components/site-header";
import { parseDateISO, todayISO } from "@/lib/dates";
import {
  getLatestMapDate,
  listCountriesWithIncidentsForDate,
  listIncidentsForDate,
} from "@/lib/geo/incidents";
import { getTheaterBySlug, listTheaters } from "@/lib/db/queries";
import { ensureSitrepForTheaterDay } from "@/lib/ai/sitrep";
import { getLocale } from "@/lib/i18n/locale";
import { theaterName } from "@/lib/i18n/content";
import { t } from "@/lib/i18n/dictionary";
import { getNewsForDay } from "@/lib/news/items";

type SitrepJson = {
  headline_pl?: string;
  headline_en?: string;
  body_pl?: string;
  body_en?: string;
  key_points_pl?: string[];
  key_points_en?: string[];
  markdown_pl?: string;
};

export const dynamic = "force-dynamic";

export default async function TheaterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; country?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const d = t(locale);

  const theater = await getTheaterBySlug(slug);
  if (!theater) notFound();

  const requested = sp.date && parseDateISO(sp.date) ? sp.date : null;
  const date =
    requested ?? (await getLatestMapDate(theater.slug)) ?? todayISO();

  const [theaters, rows, news, countries] = await Promise.all([
    listTheaters(),
    listIncidentsForDate({
      date,
      theaterSlug: theater.slug,
      mapEligibleOnly: true,
    }),
    getNewsForDay({ date, theaterSlug: theater.slug }),
    listCountriesWithIncidentsForDate({
      date,
      theaterSlug: theater.slug,
    }),
  ]);

  // Day-scoped sitrep only — never fall back to another day's brief.
  // If this day has incidents but no brief yet, generate both languages.
  const sitrepResult = await ensureSitrepForTheaterDay(theater.id, date);
  const brief = sitrepResult.brief;

  let sitrep: SitrepJson | null = null;
  if (brief?.content) {
    try {
      sitrep = JSON.parse(brief.content) as SitrepJson;
    } catch {
      sitrep = { markdown_pl: brief.content };
    }
  }

  const incidents = rows.map((r) => ({
    id: String(r.id),
    type: r.type as never,
    confidence: r.confidence as never,
    occurred_at: String(r.occurred_at),
    title: r.title != null ? String(r.title) : null,
    summary: r.summary != null ? String(r.summary) : null,
    title_pl: r.title_pl != null ? String(r.title_pl) : null,
    title_en: r.title_en != null ? String(r.title_en) : null,
    summary_pl: r.summary_pl != null ? String(r.summary_pl) : null,
    summary_en: r.summary_en != null ? String(r.summary_en) : null,
    theater_name_pl: theater.name_pl,
    theater_name_en: theater.name_en,
    country_iso:
      r.country_iso != null && String(r.country_iso).trim()
        ? String(r.country_iso).trim().toUpperCase()
        : null,
  }));

  const briefTitle =
    locale === "en"
      ? (sitrep?.headline_en ?? null)
      : (sitrep?.headline_pl ?? null);
  const briefBody =
    locale === "en" ? (sitrep?.body_en ?? null) : (sitrep?.body_pl ?? null);
  const briefPoints =
    locale === "en" ? sitrep?.key_points_en : sitrep?.key_points_pl;

  const emptySitrep =
    !sitrep || (!briefTitle && !briefBody)
      ? incidents.length === 0
        ? d.noSitrepNoIncidents
        : d.noSitrep
      : null;

  const isHybrid = theater.slug === "europe-hybrid";

  return (
    <main className="min-h-screen bg-[var(--background)] pb-10">
      <SiteHeader
        theaters={theaters}
        locale={locale}
        date={date}
        activeTheater={theater.slug}
      />
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
            {d.theater}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--foreground)] md:text-4xl">
            {theaterName(theater, locale)}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            {locale === "en"
              ? theater.description_en
              : theater.description_pl}
          </p>
          {isHybrid && (
            <p className="mt-3 border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
              {locale === "pl"
                ? "Ścieżka Europa / hybryda — sabotaż, cyber i infrastruktura krytyczna."
                : "Europe / hybrid track — sabotage, cyber, and critical infrastructure."}
            </p>
          )}
        </div>
      </div>
      <MapShell
        locale={locale}
        date={date}
        theaterSlug={theater.slug}
        incidents={incidents}
        news={news}
        countries={countries}
        briefTitle={briefTitle}
        briefBody={briefBody ?? emptySitrep}
        briefPoints={briefPoints}
        mapView={{
          longitude: theater.center_lng ?? 20,
          latitude: theater.center_lat ?? 40,
          zoom: isHybrid ? 3.4 : 3.8,
        }}
      />
    </main>
  );
}
