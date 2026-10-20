"use client";

import { DayReader, type DayIncidentCard } from "@/components/day/day-reader";
import type { Locale } from "@/lib/i18n/dictionary";

export function MapShell({
  locale,
  date,
  geojsonUrl,
  incidents,
  briefTitle,
  briefBody,
  briefPoints,
  mapView,
}: {
  locale: Locale;
  date: string;
  geojsonUrl: string;
  incidents: DayIncidentCard[];
  briefTitle?: string | null;
  briefBody?: string | null;
  briefPoints?: string[];
  mapView?: { longitude: number; latitude: number; zoom: number };
}) {
  return (
    <DayReader
      key={geojsonUrl}
      locale={locale}
      date={date}
      geojsonUrl={geojsonUrl}
      incidents={incidents}
      briefTitle={briefTitle}
      briefBody={briefBody}
      briefPoints={briefPoints}
      mapView={mapView}
    />
  );
}
