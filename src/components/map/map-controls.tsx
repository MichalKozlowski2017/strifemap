"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { typeLabel } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { countryDisplayName } from "@/lib/geo/country-names";
import {
  INCIDENT_TYPES,
  layersToParam,
  parseCountryIso,
  parseLayers,
} from "@/lib/map/params";
import type { CountryDayChip } from "@/lib/geo/incidents";
import type { IncidentType } from "@/lib/types";

const TYPE_COLORS: Record<IncidentType, string> = {
  kinetic: "#b91c1c",
  sabotage: "#d97706",
  cyber: "#0d9488",
  air: "#b45309",
  naval: "#0369a1",
  diplomatic: "#64748b",
  other: "#a8a29e",
};

/** Compact overlays: pin count on map; chips+layers can sit below the map on mobile. */
export function MapControls({
  locale,
  pinCount,
  countries,
  /** When true, only the live badge sits on the map (chips/layers rendered via `below`). */
  mapOnly = false,
  /** When true, render chips + layers (for below-map strip). */
  belowMap = false,
}: {
  locale: Locale;
  pinCount: number | null;
  countries: CountryDayChip[];
  mapOnly?: boolean;
  belowMap?: boolean;
}) {
  const d = t(locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const layers = parseLayers(searchParams.get("layers"));
  const selected = parseCountryIso(searchParams.get("country"));
  const [layersOpen, setLayersOpen] = useState(false);

  const replaceParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("timeRange");
      params.delete("hours");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const toggleType = (type: IncidentType) => {
    replaceParams((p) => {
      const next = new Set(layers);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      const param = layersToParam(next);
      if (param == null) p.delete("layers");
      else p.set("layers", param);
    });
  };

  const selectCountry = (iso: string | null) => {
    replaceParams((p) => {
      if (!iso) p.delete("country");
      else p.set("country", iso);
    });
  };

  const liveBadge = (
    <div className="inline-flex items-center border border-[var(--border)] bg-[var(--surface)]/92 px-2 py-1 text-[10px] tabular-nums tracking-wide text-[var(--muted-2)] backdrop-blur-sm">
      {pinCount != null ? `${pinCount} · ${d.mapDayLive}` : d.mapDayLive}
    </div>
  );

  const chips = countries.length > 0 ? (
    <div
      className="flex flex-wrap gap-1"
      role="group"
      aria-label={d.countriesToday}
    >
      {countries.map((c) => {
        const on = selected === c.iso;
        return (
          <button
            key={c.iso}
            type="button"
            onClick={() => selectCountry(on ? null : c.iso)}
            className={`inline-flex min-h-9 items-center gap-1.5 px-2 text-[10px] uppercase tracking-wider transition ${
              on
                ? "bg-[var(--country-active-bg)] text-[var(--country-active-fg)]"
                : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            aria-pressed={on}
          >
            <span className="font-medium tracking-normal normal-case">
              {countryDisplayName(c.iso, locale)}
            </span>
            <span className="tabular-nums opacity-70">{c.incidentCount}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  const layersPanel = (
    <div className="border border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-sm">
      <button
        type="button"
        className="flex min-h-9 w-full items-center justify-between px-2 text-[10px] uppercase tracking-wider text-[var(--muted)] md:hidden"
        aria-expanded={layersOpen}
        onClick={() => setLayersOpen((v) => !v)}
      >
        {d.mapLayers}
        <span aria-hidden>{layersOpen ? "−" : "+"}</span>
      </button>
      <div
        className={`flex flex-wrap gap-1 p-1 ${
          layersOpen ? "flex" : "hidden md:flex"
        }`}
        role="group"
        aria-label={d.mapLayers}
      >
        {INCIDENT_TYPES.map((type) => {
          const on = layers.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`inline-flex min-h-9 items-center gap-1.5 px-2 text-[10px] uppercase tracking-wider transition ${
                on
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted-2)] opacity-45"
              }`}
              aria-pressed={on}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: on ? TYPE_COLORS[type] : "var(--muted-2)",
                }}
              />
              {typeLabel(type, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (belowMap) {
    return (
      <div
        data-wn-map-chrome
        className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 md:hidden"
      >
        {chips}
        {layersPanel}
      </div>
    );
  }

  if (mapOnly) {
    return (
      <div
        data-wn-map-chrome
        className="pointer-events-none absolute left-3 top-3 z-10 md:left-4 md:top-4"
      >
        <div className="pointer-events-auto">{liveBadge}</div>
      </div>
    );
  }

  // Desktop: compact stack on map (no second Wyczyść — clear lives on the card)
  return (
    <div
      data-wn-map-chrome
      className="pointer-events-auto absolute left-3 top-3 z-10 hidden max-w-[min(100%-1.5rem,28rem)] flex-col gap-2 md:left-4 md:top-4 md:flex"
    >
      {liveBadge}
      {chips ? (
        <div className="border border-[var(--border)] bg-[var(--surface)]/92 p-1 backdrop-blur-sm">
          {chips}
        </div>
      ) : null}
      {layersPanel}
    </div>
  );
}
