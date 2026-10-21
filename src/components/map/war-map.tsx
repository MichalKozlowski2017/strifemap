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
  selectedCountry?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectCountry?: (iso: string | null) => void;
  onPinCount?: (count: number | null) => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  className?: string;
  emptyLabel?: string;
};

const COUNTRIES_URL = "/geo/countries-110m.geojson";

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
const CLOSE_MS = 280;
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

function readCssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function WarMap({
  geojsonUrl,
  locale,
  enabledTypes,
  selectedId,
  selectedCountry,
  onSelect,
  onSelectCountry,
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
  const [data, setData] = useState<FeatureCollection<
    Point,
    MapIncidentFeatureProps
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pulseT, setPulseT] = useState(0);
  const [countriesData, setCountriesData] =
    useState<FeatureCollection | null>(null);
  const fittedCountry = useRef<string | null>(null);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setCountriesData(json);
      })
      .catch(() => {
        if (!cancelled) setCountriesData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-read CSS vars when theme class flips.
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setThemeTick((n) => n + 1));
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

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
        // Soft refresh: keep camera + hover. Hard (URL/range change): clear hover only.
        if (mode === "hard") {
          setHover(null);
          popupHoveredRef.current = false;
        }
      } catch (e) {
        setError(String(e));
        if (mode === "hard") setData(null);
      }
    },
    [geojsonUrl],
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
    const onView = () => recomputeAnchor();
    map.on("move", onView);
    map.on("zoom", onView);
    map.on("resize", onView);
  }, [recomputeAnchor]);

  // Frame selected country without fighting user pan after first fit.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !countriesData || !selectedCountry) {
      if (!selectedCountry) fittedCountry.current = null;
      return;
    }
    if (fittedCountry.current === selectedCountry) return;
    const feature = countriesData.features.find(
      (f) =>
        String((f.properties as { iso?: string } | null)?.iso || "").toUpperCase() ===
        selectedCountry.toUpperCase(),
    );
    if (!feature?.geometry) return;
    const bounds = new maplibregl.LngLatBounds();
    const extend = (coords: unknown): void => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        bounds.extend([coords[0] as number, coords[1] as number]);
        return;
      }
      for (const c of coords) extend(c);
    };
    extend(
      feature.geometry.type === "Polygon" ||
        feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates
        : null,
    );
    if (!Number.isFinite(bounds.getWest())) return;
    map.fitBounds(bounds, { padding: 48, maxZoom: 6.5, duration: 600 });
    fittedCountry.current = selectedCountry;
  }, [selectedCountry, countriesData]);

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

      const collocated = featuresAtPoint(filtered, lng, lat, locale);
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
    if (!popupHoveredRef.current) scheduleClose();
  }, [scheduleClose]);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      // Ignore clicks that started on overlay chrome (controls / card).
      const orig = e.originalEvent as MouseEvent | undefined;
      const target = orig?.target as HTMLElement | null | undefined;
      if (target?.closest?.("[data-wn-map-chrome]")) return;

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
          onSelect?.(id);
          return;
        }
      }
      const country = features.find((f) => f.layer?.id === "country-fill");
      if (country?.properties?.iso) {
        const iso = String(country.properties.iso).toUpperCase();
        onSelectCountry?.(iso);
        return;
      }
      // Empty map (or cluster) → clear country
      if (!pin) onSelectCountry?.(null);
    },
    [onSelect, onSelectCountry],
  );

  const interactiveLayerIds = useMemo(
    () => [
      "clusters",
      "unclustered-point",
      "selected-point",
      "fresh-pulse",
      "country-fill",
    ],
    [],
  );

  const countryFill = readCssColor("--country-fill", "rgba(184,154,94,0.08)");
  const countryFillActive = readCssColor(
    "--country-fill-active",
    "rgba(184,154,94,0.28)",
  );
  const countryLine = readCssColor("--country-line", "rgba(184,154,94,0.55)");
  const countryLineActive = readCssColor(
    "--country-line-active",
    "rgba(235,210,140,0.9)",
  );
  void themeTick; // recompute colors when theme class changes

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
        {countriesData && (
          <Source id="countries" type="geojson" data={countriesData}>
            <Layer
              id="country-fill"
              type="fill"
              paint={{
                "fill-color": selectedCountry
                  ? [
                      "case",
                      ["==", ["get", "iso"], selectedCountry],
                      countryFillActive,
                      countryFill,
                    ]
                  : countryFill,
                "fill-opacity": 1,
              }}
            />
            <Layer
              id="country-line"
              type="line"
              paint={{
                "line-color": selectedCountry
                  ? [
                      "case",
                      ["==", ["get", "iso"], selectedCountry],
                      countryLineActive,
                      countryLine,
                    ]
                  : countryLine,
                "line-width": selectedCountry
                  ? [
                      "case",
                      ["==", ["get", "iso"], selectedCountry],
                      1.6,
                      0.4,
                    ]
                  : 0.4,
                "line-opacity": 0.9,
              }}
            />
          </Source>
        )}
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
