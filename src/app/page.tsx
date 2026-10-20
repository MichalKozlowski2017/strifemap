import { MapShell } from "@/components/map/map-shell";
import { SiteHeader } from "@/components/site-header";
import { listTheaters } from "@/lib/db/queries";


export const dynamic = "force-dynamic";

export default async function HomePage() {
  const theaters = await listTheaters();

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <div className="wn-scanline" aria-hidden />
      <SiteHeader theaters={theaters} />

      <div className="absolute inset-0">
        <MapShell geojsonUrl="/api/geojson?hours=72" className="h-full w-full" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0c1117] via-[#0c1117]/70 to-transparent pb-6 pt-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 md:flex-row md:items-end md:justify-between md:px-6">
          <div className="wn-fade-up max-w-xl">
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide text-[#f3efe6] md:text-6xl">
              WAR NEWS
            </h1>
            <p className="wn-fade-up-delay mt-3 max-w-md text-sm leading-relaxed text-stone-300 md:text-base">
              Incydenty z teatrów konfliktów na żywej mapie — źródła, poziom
              pewności i briefingi, nie kolejny feed newsów.
            </p>
          </div>
          <p className="wn-fade-up-delay text-[11px] uppercase tracking-[0.22em] text-[#c4a35a]">
            Ostatnie 72h · map-eligible
          </p>
        </div>
      </div>
    </main>
  );
}
