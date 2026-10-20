import Link from "next/link";
import { PanelClient } from "@/components/panel/panel-client";
import { SiteHeader } from "@/components/site-header";
import {
  listPendingRaw,
  listReviewIncidents,
  listSources,
  listTheaters,
} from "@/lib/db/queries";
import { todayISO } from "@/lib/dates";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const locale = await getLocale();
  const d = t(locale);
  const date = todayISO();
  const [theaters, sources, raw, incidents] = await Promise.all([
    listTheaters(),
    listSources(),
    listPendingRaw(80),
    listReviewIncidents(60),
  ]);

  return (
    <main className="min-h-screen">
      <SiteHeader theaters={theaters} locale={locale} date={date} />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-[#f3efe6]">
          {d.panel}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-400">
          {locale === "pl"
            ? "Źródła on/off, kolejka raw, approve/reject incydentów na mapę. Human-in-the-loop — AI tylko proponuje."
            : "Sources on/off, raw queue, approve/reject incidents for the map. Human-in-the-loop — AI only proposes."}
        </p>
        <p className="mt-3 text-xs text-stone-600">
          Cron: <code>/api/cron/ingest</code> · <code>/api/cron/extract</code> ·{" "}
          <code>/api/cron/sitrep</code> · <code>/api/cron/cleanup</code>
        </p>
        <Link
          href={`/?date=${date}`}
          className="mt-4 inline-block text-xs uppercase tracking-widest text-[#c4a35a]"
        >
          {d.backToMap}
        </Link>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-10 md:px-6">
        <PanelClient sources={sources} raw={raw} incidents={incidents} />
      </div>
    </main>
  );
}
