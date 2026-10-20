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
import type {
  GeoJSONSource,
  Map as MaplibreMap,
  PositionAnchor,
} from "maplibre-gl";
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
import type { Confidence, IncidentType, MapIncidentFeatureProps } from "@/lib/types";
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

type HoverItem = {
  id: string;
  title: string;
  type: IncidentType;
  confidence: Confidence;
  occurred_at: string;
  summary: string;
};

type HoverState = {
  lng: number;
  lat: number;
  anchor: PositionAnchor;
  items: HoverItem[];
};

const POPUP_W = 300;
const POPUP_H_SINGLE = 110;
const POPUP_H_LIST = 200;
const EDGE = 16;
const COORD_EPS = 1e-5;
/** Close delay so the pointer can cross the pin→popup gap. */
const CLOSE_MS = 280;

function samePoint(a: [number, number], b: [number, number]) {
  return (
    Math.abs(a[0] - b[0]) < COORD_EPS && Math.abs(a[1] - b[1]) < COORD_EPS
  );
}

/** Pick Popup anchor so the bubble stays inside the map container.
 * MapLibre: anchor "bottom" = popup ABOVE the pin; "top" = popup BELOW. */
function pickAnchor(
  map: MaplibreMap,
  lng: number,
  lat: number,
  popupW: number,
  popupH: number,
): PositionAnchor {
  const p = map.project([lng, lat]);
  const { width, height } = map.getContainer().getBoundingClientRect();

  const roomAbove = p.y;
  const roomBelow = height - p.y;
  const roomLeft = p.x;
  const roomRight = width - p.x;
  const needV = popupH + EDGE;
  const needH = popupW / 2 + EDGE;

  // Prefer above the pin; flip downward when the header/top edge would clip it.
  let vertical: "top" | "bottom" = "bottom";
  if (roomAbove < needV && roomBelow >= roomAbove) {
    vertical = "top";
  } else if (roomBelow < needV && roomAbove >= needV) {
    vertical = "bottom";
  } else if (roomAbove < needV) {
    vertical = "top";
  }

  let horizontal: "left" | "right" | "center" = "center";
  if (roomLeft < needH && roomRight >= roomLeft) {
    horizontal = "left"; // popup extends to the right of the pin
  } else if (roomRight < needH && roomLeft >= roomRight) {
    horizontal = "right"; // popup extends to the left of the pin
  }

  if (vertical === "top" && horizontal === "left") return "top-left";
  if (vertical === "top" && horizontal === "right") return "top-right";
  if (vertical === "top") return "top";
  if (vertical === "bottom" && horizontal === "left") return "bottom-left";
  if (vertical === "bottom" && horizontal === "right") return "bottom-right";
  return "bottom";
}

function toHoverItem(
  props: MapIncidentFeatureProps,
  locale: Locale,
): HoverItem | null {
  if (!props?.id) return null;
  return {
    id: String(props.id),
    title: localizedTitle(props, locale),
    type: props.type,
    confidence: props.confidence,
    occurred_at: props.occurred_at,
    summary: localizedSummary(props, locale),
  };
}

function featuresAtPoint(
  collection: FeatureCollection<Point, MapIncidentFeatureProps> | null,
  lng: number,
  lat: number,
  locale: Locale,
): HoverItem[] {
  if (!collection) return [];
  const items: HoverItem[] = [];
  const seen = new Set<string>();
  for (const f of collection.features) {
    if (f.geometry?.type !== "Point") continue;
    const coords = f.geometry.coordinates as [number, number];
    if (!samePoint(coords, [lng, lat])) continue;
    const item = toHoverItem(f.properties, locale);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

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
  const hoverRef = useRef<HoverState | null>(null);
  const popupHoveredRef = useRef(false);
  const [data, setData] = useState<FeatureCollection<
    Point,
    MapIncidentFeatureProps
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const setCursor = useCallback((cursor: string) => {
    const map = mapRef.current?.getMap() as MaplibreMap | undefined;
    if (map) map.getCanvas().style.cursor = cursor;
  }, []);

  const scheduleClose = useCallback(() => {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      if (popupHoveredRef.current) return;
      setHover(null);
      setCursor("");
    }, CLOSE_MS);
  }, [clearLeaveTimer, setCursor]);

  const onPopupEnter = useCallback(() => {
    popupHoveredRef.current = true;
    clearLeaveTimer();
  }, [clearLeaveTimer]);

  const onPopupLeave = useCallback(() => {
    popupHoveredRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  const recomputeAnchor = useCallback(() => {
    const current = hoverRef.current;
    const map = mapRef.current?.getMap();
    if (!current || !map) return;
    const popupH =
      current.items.length > 1 ? POPUP_H_LIST : POPUP_H_SINGLE;
    const next = pickAnchor(map, current.lng, current.lat, POPUP_W, popupH);
    if (next !== current.anchor) {
      setHover({ ...current, anchor: next });
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
        popupHoveredRef.current = false;
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

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const onView = () => recomputeAnchor();
    map.on("move", onView);
    map.on("zoom", onView);
    map.on("resize", onView);
  }, [recomputeAnchor]);

  // Keep tip + bridge sticky: listen on the whole popup root (not only inner content).
  useEffect(() => {
    if (!hover) return;
    const root = document.querySelector(".wn-hover-popup");
    if (!root) return;
    const enter = () => onPopupEnter();
    const leave = () => onPopupLeave();
    root.addEventListener("mouseenter", enter);
    root.addEventListener("mouseleave", leave);
    return () => {
      root.removeEventListener("mouseenter", enter);
      root.removeEventListener("mouseleave", leave);
    };
  }, [hover, onPopupEnter, onPopupLeave]);

  const applyHover = useCallback(
    (lng: number, lat: number, items: HoverItem[]) => {
      const map = mapRef.current?.getMap();
      if (!map || items.length === 0) {
        setHover(null);
        return;
      }
      const popupH = items.length > 1 ? POPUP_H_LIST : POPUP_H_SINGLE;
      const anchor = pickAnchor(map, lng, lat, POPUP_W, popupH);
      setHover({ lng, lat, anchor, items });
    },
    [],
  );

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry?.type !== "Point") {
        // Crossing the gap toward the popup — delay close, don't snap shut.
        if (!popupHoveredRef.current) scheduleClose();
        setCursor("");
        return;
      }

      clearLeaveTimer();
      setCursor("pointer");
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const props = feature.properties as Record<string, unknown> | null;

      if (props?.cluster) {
        const map = mapRef.current?.getMap();
        const source = map?.getSource("incidents") as GeoJSONSource | undefined;
        const clusterId = Number(props.cluster_id);
        if (!source || Number.isNaN(clusterId)) {
          scheduleClose();
          return;
        }
        void source
          .getClusterLeaves(clusterId, 25, 0)
          .then((leaves) => {
            if (popupHoveredRef.current) return;
            const items = (leaves as Feature<Point, MapIncidentFeatureProps>[])
              .map((leaf) => toHoverItem(leaf.properties, locale))
              .filter(Boolean) as HoverItem[];
            applyHover(lng, lat, items);
          })
          .catch(() => scheduleClose());
        return;
      }

      // Unclustered pin: include any other incidents sharing this coordinate.
      const collocated = featuresAtPoint(data, lng, lat, locale);
      if (collocated.length > 0) {
        applyHover(lng, lat, collocated);
        return;
      }

      const pinProps = props as unknown as MapIncidentFeatureProps;
      const single = toHoverItem(pinProps, locale);
      if (!single) {
        scheduleClose();
        return;
      }
      applyHover(lng, lat, [single]);
    },
    [applyHover, clearLeaveTimer, data, locale, scheduleClose, setCursor],
  );

  const onMouseLeave = useCallback(() => {
    if (!popupHoveredRef.current) scheduleClose();
  }, [scheduleClose]);

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

  const multi = (hover?.items.length ?? 0) > 1;
  const popupOffset = useMemo(() => {
    // Push popup slightly away from the pin in the open direction.
    const a = hover?.anchor ?? "bottom";
    if (a === "top" || a === "top-left" || a === "top-right") return 14;
    if (a === "bottom" || a === "bottom-left" || a === "bottom-right") {
      return 14;
    }
    return 12;
  }, [hover?.anchor]);

  const bridgeClass = useMemo(() => {
    const a = hover?.anchor ?? "bottom";
    if (a === "top" || a === "top-left" || a === "top-right") {
      return "wn-popup-bridge wn-popup-bridge--from-top";
    }
    if (a === "bottom" || a === "bottom-left" || a === "bottom-right") {
      return "wn-popup-bridge wn-popup-bridge--from-bottom";
    }
    if (a === "left") return "wn-popup-bridge wn-popup-bridge--from-left";
    if (a === "right") return "wn-popup-bridge wn-popup-bridge--from-right";
    return "wn-popup-bridge wn-popup-bridge--from-bottom";
  }, [hover?.anchor]);

  return (
    <div className={className ?? "relative h-full w-full"}>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={interactiveLayerIds}
        onLoad={onMapLoad}
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

        {hover && hover.items.length === 1 && (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            anchor={hover.anchor}
            closeButton={false}
            closeOnClick={false}
            offset={popupOffset}
            maxWidth={`${POPUP_W}px`}
            className="wn-hover-popup"
          >
            <div
              className={`${bridgeClass} space-y-1 p-0.5 text-[#1a1a1a]`}
              onMouseEnter={onPopupEnter}
            >
              <p className="text-[10px] uppercase tracking-widest text-stone-500">
                {formatTime(hover.items[0].occurred_at, locale)} ·{" "}
                {typeLabel(hover.items[0].type, locale)}
              </p>
              <p className="text-sm font-semibold leading-snug">
                {hover.items[0].title}
              </p>
              {hover.items[0].summary && (
                <p className="text-xs leading-relaxed text-stone-600">
                  {oneSentence(hover.items[0].summary)}
                </p>
              )}
            </div>
          </Popup>
        )}

        {hover && multi && (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            anchor={hover.anchor}
            closeButton={false}
            closeOnClick={false}
            offset={popupOffset}
            maxWidth={`${POPUP_W}px`}
            className="wn-hover-popup"
          >
            <div
              className={`${bridgeClass} p-0.5 text-[#1a1a1a]`}
              onMouseEnter={onPopupEnter}
            >
              <p className="mb-1.5 text-[10px] uppercase tracking-widest text-stone-500">
                {d.clusterIncidents}
              </p>
              <ul className="max-h-52 space-y-1 overflow-y-auto text-xs">
                {hover.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full rounded px-1.5 py-1.5 text-left leading-snug hover:bg-amber-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        clearLeaveTimer();
                        popupHoveredRef.current = false;
                        setHover(null);
                        onSelect?.(item.id);
                      }}
                    >
                      <span className="block text-[10px] uppercase tracking-wider text-stone-500">
                        {formatTime(item.occurred_at, locale)} ·{" "}
                        {typeLabel(item.type, locale)}
                      </span>
                      <span className="font-medium">{item.title}</span>
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
