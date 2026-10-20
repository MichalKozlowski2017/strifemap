"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Map, { Layer, NavigationControl, Source } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { Locale } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";
import type { MapIncidentFeatureProps } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

type Props = {
  geojsonUrl: string;
  locale: Locale;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  className?: string;
  emptyLabel?: string;
};

export function WarMap({
  geojsonUrl,
  locale,
  selectedId,
  onSelect,
  initialViewState = { longitude: 25, latitude: 35, zoom: 2.2 },
  className,
  emptyLabel,
}: Props) {
  const d = t(locale);
  const [data, setData] = useState<FeatureCollection<
    Point,
    MapIncidentFeatureProps
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(geojsonUrl)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setError(null);
        setData(json);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [geojsonUrl]);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry?.type !== "Point") return;
      if (feature.properties?.cluster) return;
      const id = String(
        (feature.properties as MapIncidentFeatureProps).id ?? "",
      );
      if (!id) return;
      onSelect?.(id);
    },
    [onSelect],
  );

  const interactiveLayerIds = useMemo(
    () => ["clusters", "unclustered-point", "selected-point"],
    [],
  );

  const empty =
    data && Array.isArray(data.features) && data.features.length === 0;

  return (
    <div className={className ?? "relative h-full w-full"}>
      <Map
        mapLib={maplibregl}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onClick}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {data && (
          <Source
            id="incidents"
            type="geojson"
            data={data}
            cluster
            clusterMaxZoom={12}
            clusterRadius={48}
          >
            <Layer
              id="clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#c4a35a",
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  16,
                  5,
                  22,
                  15,
                  28,
                ],
                "circle-opacity": 0.85,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#0c1117",
              }}
            />
            <Layer
              id="cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-size": 12,
              }}
              paint={{ "text-color": "#0c1117" }}
            />
            <Layer
              id="unclustered-point"
              type="circle"
              filter={
                selectedId
                  ? [
                      "all",
                      ["!", ["has", "point_count"]],
                      ["!=", ["get", "id"], selectedId],
                    ]
                  : ["!", ["has", "point_count"]]
              }
              paint={{
                "circle-color": [
                  "match",
                  ["get", "type"],
                  "sabotage",
                  "#d97706",
                  "cyber",
                  "#0d9488",
                  "air",
                  "#b45309",
                  "naval",
                  "#0369a1",
                  "kinetic",
                  "#b91c1c",
                  "diplomatic",
                  "#64748b",
                  "#a8a29e",
                ],
                "circle-radius": 7,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#f5f0e6",
              }}
            />
            {selectedId ? (
              <Layer
                id="selected-point"
                type="circle"
                filter={[
                  "all",
                  ["!", ["has", "point_count"]],
                  ["==", ["get", "id"], selectedId],
                ]}
                paint={{
                  "circle-color": "#c4a35a",
                  "circle-radius": 10,
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#f5f0e6",
                }}
              />
            ) : null}
          </Source>
        )}
      </Map>
      {error && (
        <div className="absolute left-4 top-4 bg-red-950/80 px-3 py-2 text-xs text-red-100">
          {d.mapError}: {error}
        </div>
      )}
      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="bg-black/50 px-3 py-1 text-xs tracking-widest text-stone-300">
            {d.loadingMap}
          </span>
        </div>
      )}
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0c1117]/35">
          <p className="max-w-sm px-4 text-center text-sm text-stone-300">
            {emptyLabel ?? d.emptyDay}
          </p>
        </div>
      )}
    </div>
  );
}
