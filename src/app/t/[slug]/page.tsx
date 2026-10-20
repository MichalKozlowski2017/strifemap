import Link from "next/link";
import { notFound } from "next/navigation";
import { MapShell } from "@/components/map/map-shell";
import { SiteHeader } from "@/components/site-header";
import {
  getTheaterBySlug,
  latestBrief,
  listIncidentsForTheater,
  listTheaters,
} from "@/lib/db/queries";


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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theater = await getTheaterBySlug(slug);
  if (!theater) notFound();

  const [theaters, incidents, brief] = await Promise.all([
    listTheaters(),
    listIncidentsForTheater(theater.id),
    latestBrief(theater.id),
  ]);

  let sitrep: SitrepJson | null = null;
  if (brief?.content) {
    try {
      sitrep = JSON.parse(brief.content) as SitrepJson;
    } catch {
      sitrep = { markdown_pl: brief.content };
    }
  }

  const isHybrid = theater.slug === "europe-hybrid";

  return (
    <main className="min-h-screen pb-16">
      <div className="relative h-[48vh] min-h-[320px] w-full overflow-hidden border-b border-white/10">
        <SiteHeader theaters={theaters} compact />
        <MapShell
          geojsonUrl={`/api/geojson?hours=168&theater=${theater.slug}`}
          initialViewState={{
            longitude: theater.center_lng ?? 20,
            latitude: theater.center_lat ?? 40,
            zoom: isHybrid ? 3.4 : 3.8,
          }}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c1117] to-transparent p-6 pt-20">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#c4a35a]">
            Teatr
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-[#f3efe6] md:text-5xl">
            {theater.name_pl}
          </h1>
          <p className="mt-1 text-sm text-stone-400">{theater.name_en}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:px-6">
        <section>
          {isHybrid && (
            <div className="mb-6 border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              Ścieżka <strong>Europa / hybryda</strong> — sabotaż, cyber i
              infrastruktura krytyczna, osobno od frontu UA.
            </div>
          )}
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
            Sitrep
          </h2>
          {sitrep ? (
            <article className="mt-4 space-y-3 text-stone-200">
              <h3 className="text-xl font-medium">
                {sitrep.headline_pl ?? "Briefing"}
              </h3>
              <p className="leading-relaxed text-stone-300">{sitrep.body_pl}</p>
              {sitrep.key_points_pl && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-stone-400">
                  {sitrep.key_points_pl.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {sitrep.headline_en && (
                <details className="pt-2 text-sm text-stone-500">
                  <summary className="cursor-pointer text-[#c4a35a]">
                    English
                  </summary>
                  <p className="mt-2 font-medium text-stone-300">
                    {sitrep.headline_en}
                  </p>
                  <p className="mt-1">{sitrep.body_en}</p>
                </details>
              )}
            </article>
          ) : (
            <p className="mt-4 text-sm text-stone-500">
              Brak dziennego sitrep — uruchom{" "}
              <code className="text-stone-300">/api/cron/sitrep</code> po
              approve incydentów (wymaga OPENAI_API_KEY) albo użyj seeda.
            </p>
          )}
          <p className="mt-4 text-sm text-stone-500">{theater.description_pl}</p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
            Incydenty
          </h2>
          <ul className="mt-4 space-y-3">
            {incidents
              .filter((i) => i.status !== "rejected")
              .map((i) => (
                <li
                  key={i.id}
                  className="border border-white/10 bg-black/20 px-3 py-3"
                >
                  <p className="text-[10px] uppercase tracking-widest text-stone-500">
                    {i.type} · {i.confidence} · {i.status}
                    {i.map_eligible ? " · mapa" : ""}
                  </p>
                  <p className="mt-1 font-medium text-stone-100">{i.title}</p>
                  <p className="mt-1 text-sm text-stone-400">{i.summary}</p>
                  <p className="mt-2 text-[11px] text-stone-600">
                    {new Date(i.occurred_at).toLocaleString("pl-PL")}
                  </p>
                </li>
              ))}
            {incidents.length === 0 && (
              <li className="text-sm text-stone-500">Brak incydentów.</li>
            )}
          </ul>
          <Link
            href="/panel"
            className="mt-6 inline-block text-xs uppercase tracking-widest text-stone-500 hover:text-[#c4a35a]"
          >
            Panel review →
          </Link>
        </section>
      </div>
    </main>
  );
}
