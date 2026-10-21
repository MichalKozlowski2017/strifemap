"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DayReader, type DayIncidentCard } from "@/components/day/day-reader";
import type { Locale } from "@/lib/i18n/dictionary";
import {
  buildGeojsonUrl,
  parseLayers,
  parseTimeRange,
} from "@/lib/map/params";
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
  const timeRange = parseTimeRange(searchParams.get("timeRange"));
  const enabledTypes = useMemo(
    () => parseLayers(searchParams.get("layers")),
    [searchParams],
  );
  const geojsonUrl = useMemo(
    () => buildGeojsonUrl({ timeRange, theaterSlug }),
    [timeRange, theaterSlug],
  );

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
