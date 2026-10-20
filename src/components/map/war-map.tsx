"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { FeatureCollection, Point } from "geojson";
import type { MapIncidentFeatureProps } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  geojsonUrl: string;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  className?: string;
};

type Selected = MapIncidentFeatureProps & {
  lng: number;
  lat: number;
  sources?: { url: string; title: string; source_name: string }[];
};

export function WarMap({
  geojsonUrl,
  initialViewState = { longitude: 25, latitude: 35, zoom: 2.2 },
  className,
}: Props) {
  const [data, setData] = useState<FeatureCollection<
    Point,
    MapIncidentFeatureProps
  > | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(geojsonUrl)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [geojsonUrl]);

  const onClick = useCallback(async (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature || feature.geometry?.type !== "Point") return;
    if (feature.properties?.cluster) return;

    const props = feature.properties as MapIncidentFeatureProps;
    const coords = feature.geometry.coordinates as [number, number];
    const [lng, lat] = coords;
    setSelected({ ...props, lng, lat });

    try {
      const res = await fetch(`/api/incidents/${props.id}`);
      if (res.ok) {
        const body = await res.json();
        setSelected((prev) =>
          prev ? { ...prev, sources: body.sources ?? [] } : prev,
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const interactiveLayerIds = useMemo(
    () => ["clusters", "unclustered-point"],
    [],
  );

  return (
    <div className={className ?? "relative h-full w-full"}>
      <Map
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
              filter={["!", ["has", "point_count"]]}
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
          </Source>
        )}
        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            onClose={() => setSelected(null)}
            closeOnClick={false}
            maxWidth="320px"
          >
            <article className="space-y-2 p-1 text-[#1a1a1a]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                {selected.theater_name_pl} · {selected.type} ·{" "}
                {selected.confidence}
              </p>
              <h3 className="text-lg font-semibold leading-tight">
                {selected.title}
              </h3>
              <p className="text-sm leading-relaxed text-stone-700">
                {selected.summary}
              </p>
              <p className="text-[11px] text-stone-500">
                {new Date(selected.occurred_at).toLocaleString("pl-PL")}
              </p>
              {selected.sources && selected.sources.length > 0 && (
                <ul className="space-y-1 border-t border-stone-200 pt-2 text-xs">
                  {selected.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-800 underline-offset-2 hover:underline"
                      >
                        {s.source_name}: {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </Popup>
        )}
      </Map>
      {error && (
        <div className="absolute left-4 top-4 rounded bg-red-950/80 px-3 py-2 text-xs text-red-100">
          Map data error: {error}
        </div>
      )}
      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-black/50 px-3 py-1 text-xs tracking-widest text-stone-300">
            ŁADOWANIE MAPY…
          </span>
        </div>
      )}
    </div>
  );
}
