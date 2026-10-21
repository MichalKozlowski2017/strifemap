import { MapShell } from "@/components/map/map-shell";
import { SiteHeader } from "@/components/site-header";
import { parseDateISO, todayISO } from "@/lib/dates";
import { getLatestMapDate, listIncidentsForDate } from "@/lib/geo/incidents";
import { toDayIncidentCards } from "@/lib/geo/map-incident-cards";
import { getLocale } from "@/lib/i18n/locale";
import { listTheaters } from "@/lib/db/queries";
import { getNewsForDay } from "@/lib/news/items";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; country?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const theaters = await listTheaters();

  const requested = params.date && parseDateISO(params.date) ? params.date : null;
  const date = requested ?? (await getLatestMapDate()) ?? todayISO();

  const [rows, news] = await Promise.all([
    listIncidentsForDate({ date, mapEligibleOnly: true }),
    getNewsForDay({ date }),
  ]);
  const incidents = toDayIncidentCards(rows, news);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <SiteHeader theaters={theaters} locale={locale} date={date} />
      <MapShell
        locale={locale}
        date={date}
        incidents={incidents}
        news={news}
      />
    </main>
  );
}
