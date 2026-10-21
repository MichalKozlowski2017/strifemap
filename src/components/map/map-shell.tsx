"use client";

import { Suspense, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DayReader, type DayIncidentCard } from "@/components/day/day-reader";
import type { Locale } from "@/lib/i18n/dictionary";
import { buildGeojsonUrl, parseLayers } from "@/lib/map/params";
import type { DayNewsCard } from "@/lib/news/items";

function MapShellInner({
  locale,
  date,
  theaterSlug,
  incidents,
  news,
  briefTitle,
  briefBody,
  briefPoints,
  mapView,
}: {
  locale: Locale;
  date: string;
  theaterSlug?: string;
  incidents: DayIncidentCard[];
  news?: DayNewsCard[];
  briefTitle?: string | null;
  briefBody?: string | null;
  briefPoints?: string[];
  mapView?: { longitude: number; latitude: number; zoom: number };
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const enabledTypes = useMemo(
    () => parseLayers(searchParams.get("layers")),
    [searchParams],
  );
  const geojsonUrl = useMemo(
    () => buildGeojsonUrl({ date, theaterSlug }),
    [date, theaterSlug],
  );

  // Drop legacy ?country= so it never drives UI or polygon work.
  useEffect(() => {
    if (!searchParams.has("country")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("country");
    params.delete("timeRange");
    params.delete("hours");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <DayReader
      key={date}
      locale={locale}
      date={date}
      geojsonUrl={geojsonUrl}
      enabledTypes={enabledTypes}
      incidents={incidents}
      news={news}
      briefTitle={briefTitle}
      briefBody={briefBody}
      briefPoints={briefPoints}
      mapView={mapView}
    />
  );
}

export function MapShell(props: {
  locale: Locale;
  date: string;
  theaterSlug?: string;
  incidents: DayIncidentCard[];
  news?: DayNewsCard[];
  briefTitle?: string | null;
  briefBody?: string | null;
  briefPoints?: string[];
  mapView?: { longitude: number; latitude: number; zoom: number };
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] min-h-[280px] items-center justify-center text-sm text-[var(--muted)]">
          …
        </div>
      }
    >
      <MapShellInner {...props} />
    </Suspense>
  );
}
