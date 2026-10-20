import { MapShell } from "@/components/map/map-shell";
import { SiteHeader } from "@/components/site-header";
import { parseDateISO, todayISO } from "@/lib/dates";
import { getLatestMapDate, listIncidentsForDate } from "@/lib/geo/incidents";
import { getLocale } from "@/lib/i18n/locale";
import { listTheaters } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const theaters = await listTheaters();

  const requested = params.date && parseDateISO(params.date) ? params.date : null;
  const date = requested ?? (await getLatestMapDate()) ?? todayISO();

  const rows = await listIncidentsForDate({ date, mapEligibleOnly: true });
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
    theater_name_pl: r.name_pl != null ? String(r.name_pl) : undefined,
    theater_name_en: r.name_en != null ? String(r.name_en) : undefined,
  }));

  return (
    <main className="min-h-screen">
      <div className="wn-scanline" aria-hidden />
      <SiteHeader theaters={theaters} locale={locale} date={date} />
      <MapShell
        locale={locale}
        date={date}
        geojsonUrl={`/api/geojson?date=${date}`}
        incidents={incidents}
      />
    </main>
  );
}
