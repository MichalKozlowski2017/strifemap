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
import { useTheme } from "@/components/theme/theme-provider";
import { INCIDENT_TYPES } from "@/lib/map/params";
import type {
  Confidence,
  IncidentType,
  MapIncidentFeatureProps,
} from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MAP_STYLE_LIGHT =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

type Props = {
  geojsonUrl: string;
  locale: Locale;
  /** Types currently visible; omit / full set = all. */
  enabledTypes?: Set<IncidentType>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onPinCount?: (count: number | null) => void;
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
/** Grace to cross from pin/cluster onto the popup list. */
const CLOSE_MS = 320;
const POLL_MS = 120_000;

function samePoint(a: [number, number], b: [number, number]) {
  return (
    Math.abs(a[0] - b[0]) < COORD_EPS && Math.abs(a[1] - b[1]) < COORD_EPS
  );
}

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
    horizontal = "left";
  } else if (roomRight < needH && roomLeft >= roomRight) {
    horizontal = "right";
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
  enabledTypes,
  selectedId,
  onSelect,
  onPinCount,
  initialViewState = { longitude: 25, latitude: 35, zoom: 2.2 },
  className,
  emptyLabel,
}: Props) {
  const d = t(locale);
  const { theme } = useTheme();
  const mapStyle = theme === "light" ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;
  const mapRef = useRef<MapRef>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef<HoverState | null>(null);
  const popupHoveredRef = useRef(false);
  const pinHoveredRef = useRef(false);
  /** Bumped on every close / leave so stale cluster leaf fetches cannot reopen. */
  const hoverEpochRef = useRef(0);
  const [data, setData] = useState<FeatureCollection<
    Point,
    MapIncidentFeatureProps
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pulseT, setPulseT] = useState(0);

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

  const closeHover = useCallback(() => {
    clearLeaveTimer();
    hoverEpochRef.current += 1;
    popupHoveredRef.current = false;
    pinHoveredRef.current = false;
    setHover(null);
    setCursor("");
  }, [clearLeaveTimer, setCursor]);

  const scheduleClose = useCallback(() => {
    clearLeaveTimer();
    const epoch = hoverEpochRef.current;
    leaveTimer.current = setTimeout(() => {
      if (epoch !== hoverEpochRef.current) return;
      if (popupHoveredRef.current || pinHoveredRef.current) return;
      closeHover();
    }, CLOSE_MS);
  }, [clearLeaveTimer, closeHover]);

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

  const loadGeojson = useCallback(
    async (mode: "hard" | "soft") => {
      try {
        const res = await fetch(geojsonUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FeatureCollection<
          Point,
          MapIncidentFeatureProps
        >;
        setError(null);
        setData(json);
        // Soft refresh: keep camera + hover. Hard (URL/range change): clear hover.
        if (mode === "hard") {
          closeHover();
        }
      } catch (e) {
        setError(String(e));
        if (mode === "hard") setData(null);
      }
    },
    [closeHover, geojsonUrl],
  );

  useEffect(() => {
    let cancelled = false;
    // Defer so the effect stays a subscription to geojsonUrl, not sync setState.
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      void loadGeojson("hard");
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [loadGeojson]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void loadGeojson("soft");
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void loadGeojson("soft");
    };
    const onFocus = () => void loadGeojson("soft");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadGeojson]);

  // Restrained pulse for fresh pins (respect reduced motion).
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setPulseT((t) => (t + 1) % 40);
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    // undefined → all; empty Set → none (user toggled everything off)
    if (!enabledTypes) return data;
    if (enabledTypes.size === 0) {
      return { type: "FeatureCollection" as const, features: [] };
    }
    if (enabledTypes.size >= INCIDENT_TYPES.length) return data;
    return {
      type: "FeatureCollection" as const,
      features: data.features.filter((f) =>
        enabledTypes.has(f.properties.type),
      ),
    };
  }, [data, enabledTypes]);

  useEffect(() => {
    onPinCount?.(filtered ? filtered.features.length : null);
  }, [filtered, onPinCount]);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Test/debug hook for Playwright — not used by app UI.
    (window as unknown as { __wnMap?: MaplibreMap }).__wnMap = map;
    const onView = () => recomputeAnchor();
    map.on("move", onView);
    map.on("zoom", onView);
    map.on("resize", onView);
  }, [recomputeAnchor]);

  const applyHover = useCallback(
    (lng: number, lat: number, items: HoverItem[], epoch: number) => {
      if (epoch !== hoverEpochRef.current) return;
      const map = mapRef.current?.getMap();
      if (!map || items.length === 0) {
        closeHover();
        return;
      }
      const popupH = items.length > 1 ? POPUP_H_LIST : POPUP_H_SINGLE;
      const anchor = pickAnchor(map, lng, lat, POPUP_W, popupH);
      const prev = hoverRef.current;
      if (
        prev &&
        prev.items.length === items.length &&
        prev.items.every((it, i) => it.id === items[i]?.id) &&
        Math.abs(prev.lng - lng) < COORD_EPS &&
        Math.abs(prev.lat - lat) < COORD_EPS &&
        prev.anchor === anchor
      ) {
        return;
      }
      setHover({ lng, lat, anchor, items });
    },
    [closeHover],
  );

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      if (popupHoveredRef.current) return;

      const feature = e.features?.[0];
      if (!feature || feature.geometry?.type !== "Point") {
        pinHoveredRef.current = false;
        scheduleClose();
        setCursor("");
        return;
      }

      pinHoveredRef.current = true;
      clearLeaveTimer();
      setCursor("pointer");
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const props = feature.properties as Record<string, unknown> | null;
      const epoch = hoverEpochRef.current;

      if (props?.cluster) {
        const map = mapRef.current?.getMap();
        const source = map?.getSource("incidents") as GeoJSONSource | undefined;
        const clusterId = Number(props.cluster_id);
        if (!source || Number.isNaN(clusterId)) {
          pinHoveredRef.current = false;
          scheduleClose();
          return;
        }
        void source
          .getClusterLeaves(clusterId, 25, 0)
          .then((leaves) => {
            if (epoch !== hoverEpochRef.current) return;
            if (popupHoveredRef.current) return;
            if (!pinHoveredRef.current) return;
            const items = (leaves as Feature<Point, MapIncidentFeatureProps>[])
              .map((leaf) => toHoverItem(leaf.properties, locale))
              .filter(Boolean) as HoverItem[];
            applyHover(lng, lat, items, epoch);
          })
          .catch(() => {
            if (epoch === hoverEpochRef.current) scheduleClose();
          });
        return;
      }

      const collocated = featuresAtPoint(filtered, lng, lat, locale);
      if (collocated.length > 0) {
        applyHover(lng, lat, collocated, epoch);
        return;
      }

      const pinProps = props as unknown as MapIncidentFeatureProps;
      const single = toHoverItem(pinProps, locale);
      if (!single) {
        pinHoveredRef.current = false;
        scheduleClose();
        return;
      }
      applyHover(lng, lat, [single], epoch);
    },
    [
      applyHover,
      clearLeaveTimer,
      filtered,
      locale,
      scheduleClose,
      setCursor,
    ],
  );

  const onMouseLeave = useCallback(() => {
    pinHoveredRef.current = false;
    if (!popupHoveredRef.current) scheduleClose();
  }, [scheduleClose]);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const orig = e.originalEvent as MouseEvent | undefined;
      const target = orig?.target as HTMLElement | null | undefined;
      if (target?.closest?.("[data-wn-map-chrome]")) return;
      // Tap/click on the popup itself (list item) is handled there.
      if (target?.closest?.(".wn-hover-popup")) return;

      const features = e.features ?? [];
      const pin = features.find(
        (f) =>
          f.layer?.id === "unclustered-point" ||
          f.layer?.id === "selected-point",
      );
      if (pin && pin.geometry?.type === "Point" && !pin.properties?.cluster) {
        const id = String(
          (pin.properties as MapIncidentFeatureProps).id ?? "",
        );
        if (id) {
          closeHover();
          onSelect?.(id);
          return;
        }
      }

      // Touch/click on a cluster: open (or keep) the list — do not dismiss.
      const cluster = features.find((f) => f.layer?.id === "clusters");
      if (cluster?.geometry?.type === "Point") {
        const [lng, lat] = cluster.geometry.coordinates as [number, number];
        const props = cluster.properties as Record<string, unknown> | null;
        const map = mapRef.current?.getMap();
        const source = map?.getSource("incidents") as GeoJSONSource | undefined;
        const clusterId = Number(props?.cluster_id);
        if (source && !Number.isNaN(clusterId)) {
          clearLeaveTimer();
          pinHoveredRef.current = true;
          const epoch = hoverEpochRef.current;
          void source.getClusterLeaves(clusterId, 25, 0).then((leaves) => {
            if (epoch !== hoverEpochRef.current) return;
            const items = (leaves as Feature<Point, MapIncidentFeatureProps>[])
              .map((leaf) => toHoverItem(leaf.properties, locale))
              .filter(Boolean) as HoverItem[];
            applyHover(lng, lat, items, epoch);
          });
        }
        return;
      }

      // Empty map / outside popup → dismiss (mouse + touch).
      closeHover();
    },
    [applyHover, clearLeaveTimer, closeHover, locale, onSelect],
  );

  const interactiveLayerIds = useMemo(
    () => ["clusters", "unclustered-point", "selected-point", "fresh-pulse"],
    [],
  );

  const empty =
    filtered &&
    Array.isArray(filtered.features) &&
    filtered.features.length === 0;

  const multi = (hover?.items.length ?? 0) > 1;
  const popupOffset = useMemo(() => {
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

  // pulseT 0..39 → gentle opacity/radius cycle
  const pulseOpacity = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin((pulseT / 40) * Math.PI * 2));
  const pulseRadius = 12 + 4 * (0.5 + 0.5 * Math.sin((pulseT / 40) * Math.PI * 2));

  return (
    <div className={className ?? "relative h-full w-full"}>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={interactiveLayerIds}
        onLoad={onMapLoad}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {filtered && (
          <Source
            id="incidents"
            type="geojson"
            data={filtered}
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
              id="fresh-pulse"
              type="circle"
              filter={[
                "all",
                ["!", ["has", "point_count"]],
                ["==", ["get", "fresh"], 1],
              ]}
              paint={{
                "circle-color": "#c4a35a",
                "circle-radius": pulseRadius,
                "circle-opacity": pulseOpacity,
                "circle-stroke-width": 0,
              }}
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
              onPointerEnter={onPopupEnter}
              onPointerLeave={onPopupLeave}
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
              onPointerEnter={onPopupEnter}
              onPointerLeave={onPopupLeave}
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
                        closeHover();
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
        <div className="absolute bottom-14 left-3 z-10 max-w-sm bg-red-950/80 px-3 py-2 text-xs text-red-100 md:left-4">
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
