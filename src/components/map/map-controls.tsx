"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { typeLabel } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import {
  INCIDENT_TYPES,
  TIME_RANGES,
  layersToParam,
  parseLayers,
  parseTimeRange,
  type TimeRange,
} from "@/lib/map/params";
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

export function MapControls({
  locale,
  pinCount,
}: {
  locale: Locale;
  pinCount: number | null;
}) {
  const d = t(locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeRange = parseTimeRange(searchParams.get("timeRange"));
  const layers = parseLayers(searchParams.get("layers"));

  const replaceParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTimeRange = (next: TimeRange) => {
    replaceParams((p) => {
      if (next === "7d") p.delete("timeRange");
      else p.set("timeRange", next);
    });
  };

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

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10 flex max-w-[min(100%-1.5rem,28rem)] flex-col gap-2 md:left-4 md:top-4">
      <div
        className="flex flex-wrap items-center gap-1 border border-[var(--border)] bg-[var(--surface)]/92 p-1 backdrop-blur-sm"
        role="group"
        aria-label={d.mapTimeRange}
      >
        {TIME_RANGES.map((range) => {
          const active = timeRange === range;
          return (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`min-h-9 px-2.5 text-[11px] uppercase tracking-wider transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              aria-pressed={active}
            >
              {range === "24h"
                ? d.mapRange24h
                : range === "3d"
                  ? d.mapRange3d
                  : d.mapRange7d}
            </button>
          );
        })}
        {pinCount != null ? (
          <span className="ml-1 border-l border-[var(--border)] px-2 text-[10px] tabular-nums tracking-wide text-[var(--muted-2)]">
            {pinCount}
          </span>
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-1 border border-[var(--border)] bg-[var(--surface)]/92 p-1 backdrop-blur-sm"
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
}
