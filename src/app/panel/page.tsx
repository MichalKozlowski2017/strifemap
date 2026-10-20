import Link from "next/link";
import { PanelClient } from "@/components/panel/panel-client";
import {
  listPendingRaw,
  listReviewIncidents,
  listSources,
  listTheaters,
} from "@/lib/db/queries";
import { SiteHeader } from "@/components/site-header";


export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const [theaters, sources, raw, incidents] = await Promise.all([
    listTheaters(),
    listSources(),
    listPendingRaw(80),
    listReviewIncidents(60),
  ]);

  return (
    <main className="min-h-screen">
      <div className="relative border-b border-white/10 pb-8 pt-24">
        <SiteHeader theaters={theaters} compact />
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-[#f3efe6]">
            Panel
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Źródła on/off, kolejka raw, approve/reject incydentów na mapę.
            Human-in-the-loop — AI tylko proponuje.
          </p>
          <p className="mt-3 text-xs text-stone-600">
            Crony:{" "}
            <code>/api/cron/ingest</code> · <code>/api/cron/extract</code> ·{" "}
            <code>/api/cron/sitrep</code> · <code>/api/cron/cleanup</code>
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-xs uppercase tracking-widest text-[#c4a35a]"
          >
            ← Mapa
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <PanelClient sources={sources} raw={raw} incidents={incidents} />
      </div>
    </main>
  );
}
