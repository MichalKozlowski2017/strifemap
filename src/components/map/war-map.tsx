"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import {
  localizedSummary,
  localizedTitle,
  typeLabel,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { oneSentence } from "@/lib/i18n/text";
import { formatTime } from "@/lib/dates";
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

type HoverPin = {
  kind: "pin";
  lng: number;
  lat: number;
  props: MapIncidentFeatureProps;
};

type HoverCluster = {
  kind: "cluster";
  lng: number;
  lat: number;
  items: { id: string; title: string }[];
};

type HoverState = HoverPin | HoverCluster | null;

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
  const mapRef = useRef<MapRef>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [data, setData] = useState<FeatureCollection<
    Point,
    MapIncidentFeatureProps
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(geojsonUrl)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setError(null);
        setData(json);
        setHover(null);
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

  const setCursor = useCallback((cursor: string) => {
    const map = mapRef.current?.getMap() as MaplibreMap | undefined;
    if (map) map.getCanvas().style.cursor = cursor;
  }, []);

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      clearLeaveTimer();
      const feature = e.features?.[0];
      if (!feature || feature.geometry?.type !== "Point") {
        setHover(null);
        setCursor("");
        return;
      }

      setCursor("pointer");
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const props = feature.properties as Record<string, unknown> | null;

      if (props?.cluster) {
        const map = mapRef.current?.getMap();
        const source = map?.getSource("incidents") as GeoJSONSource | undefined;
        const clusterId = Number(props.cluster_id);
        if (!source || Number.isNaN(clusterId)) {
          setHover(null);
          return;
        }
        void source
          .getClusterLeaves(clusterId, 25, 0)
          .then((leaves) => {
            const items = (
              leaves as Feature<Point, MapIncidentFeatureProps>[]
            )
              .map((leaf) => {
                const p = leaf.properties;
                if (!p?.id) return null;
                return {
                  id: String(p.id),
                  title: localizedTitle(p, locale),
                };
              })
              .filter(Boolean) as { id: string; title: string }[];
            setHover({ kind: "cluster", lng, lat, items });
          })
          .catch(() => setHover(null));
        return;
      }

      const pinProps = props as unknown as MapIncidentFeatureProps;
      if (!pinProps?.id) {
        setHover(null);
        return;
      }
      setHover({ kind: "pin", lng, lat, props: pinProps });
    },
    [clearLeaveTimer, locale, setCursor],
  );

  const onMouseLeave = useCallback(() => {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      setHover(null);
      setCursor("");
    }, 180);
  }, [clearLeaveTimer, setCursor]);

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
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
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

        {hover?.kind === "pin" && (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={14}
            maxWidth="280px"
            className="wn-hover-popup"
          >
            <div
              className="space-y-1 p-0.5 text-[#1a1a1a]"
              onMouseEnter={clearLeaveTimer}
            >
              <p className="text-[10px] uppercase tracking-widest text-stone-500">
                {formatTime(hover.props.occurred_at, locale)} ·{" "}
                {typeLabel(hover.props.type, locale)}
              </p>
              <p className="text-sm font-semibold leading-snug">
                {localizedTitle(hover.props, locale)}
              </p>
              <p className="text-xs leading-relaxed text-stone-600">
                {oneSentence(localizedSummary(hover.props, locale))}
              </p>
            </div>
          </Popup>
        )}

        {hover?.kind === "cluster" && hover.items.length > 0 && (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={16}
            maxWidth="300px"
            className="wn-hover-popup"
          >
            <div
              className="p-0.5 text-[#1a1a1a]"
              onMouseEnter={clearLeaveTimer}
            >
              <p className="mb-1.5 text-[10px] uppercase tracking-widest text-stone-500">
                {d.clusterIncidents}
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {hover.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full rounded px-1.5 py-1 text-left font-medium leading-snug hover:bg-amber-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        clearLeaveTimer();
                        setHover(null);
                        onSelect?.(item.id);
                      }}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Popup>
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
