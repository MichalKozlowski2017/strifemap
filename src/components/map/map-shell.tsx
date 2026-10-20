"use client";

import { WarMap } from "@/components/map/war-map";

export function MapShell({
  geojsonUrl,
  initialViewState,
  className,
}: {
  geojsonUrl: string;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  className?: string;
}) {
  return (
    <WarMap
      geojsonUrl={geojsonUrl}
      initialViewState={initialViewState}
      className={className}
    />
  );
}
