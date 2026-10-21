"use client";

import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DayReader, type DayIncidentCard } from "@/components/day/day-reader";
import type { Locale } from "@/lib/i18n/dictionary";
import type { CountryDayChip } from "@/lib/geo/incidents";
import {
  buildGeojsonUrl,
  parseCountryIso,
  parseLayers,
} from "@/lib/map/params";
import type { DayNewsCard } from "@/lib/news/items";

function MapShellInner({
  locale,
  date,
  theaterSlug,
  incidents,
  news,
  countries,
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
  countries: CountryDayChip[];
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
  const selectedCountry = parseCountryIso(searchParams.get("country"));
  const geojsonUrl = useMemo(
    () => buildGeojsonUrl({ date, theaterSlug }),
    [date, theaterSlug],
  );

  const setCountry = useCallback(
    (iso: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("timeRange");
      params.delete("hours");
      if (!iso) params.delete("country");
      else params.set("country", iso);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <DayReader
      key={date}
      locale={locale}
      date={date}
      geojsonUrl={geojsonUrl}
      enabledTypes={enabledTypes}
      selectedCountry={selectedCountry}
      onSelectCountry={setCountry}
      countries={countries}
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
  countries?: CountryDayChip[];
  briefTitle?: string | null;
  briefBody?: string | null;
  briefPoints?: string[];
  mapView?: { longitude: number; latitude: number; zoom: number };
}) {
  const { countries = [], ...rest } = props;
  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] min-h-[280px] items-center justify-center text-sm text-[var(--muted)]">
          …
        </div>
      }
    >
      <MapShellInner {...rest} countries={countries} />
    </Suspense>
  );
}
