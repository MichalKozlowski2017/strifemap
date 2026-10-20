"use client";

import { useEffect, useMemo, useState } from "react";
import { WarMap } from "@/components/map/war-map";
import {
  confidenceLabel,
  localizedSummary,
  localizedTitle,
  typeLabel,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { formatTime } from "@/lib/dates";
import type { Confidence, IncidentType } from "@/lib/types";

export type DayIncidentCard = {
  id: string;
  type: IncidentType;
  confidence: Confidence;
  occurred_at: string;
  title?: string | null;
  summary?: string | null;
  title_pl?: string | null;
  title_en?: string | null;
  summary_pl?: string | null;
  summary_en?: string | null;
  theater_name_pl?: string;
  theater_name_en?: string;
};

type Props = {
  locale: Locale;
  date: string;
  geojsonUrl: string;
  incidents: DayIncidentCard[];
  briefTitle?: string | null;
  briefBody?: string | null;
  briefPoints?: string[];
  mapView?: { longitude: number; latitude: number; zoom: number };
};

const LEGEND_TYPES: IncidentType[] = [
  "kinetic",
  "sabotage",
  "cyber",
  "air",
  "naval",
  "diplomatic",
  "other",
];

const LEGEND_COLORS: Record<IncidentType, string> = {
  kinetic: "#b91c1c",
  sabotage: "#d97706",
  cyber: "#0d9488",
  air: "#b45309",
  naval: "#0369a1",
  diplomatic: "#64748b",
  other: "#a8a29e",
};

export function DayReader({
  locale,
  geojsonUrl,
  incidents,
  briefTitle,
  briefBody,
  briefPoints,
  mapView,
}: Props) {
  const d = t(locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const el = document.getElementById(`incident-${selectedId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const synthesized = useMemo(() => {
    if (briefTitle || briefBody) return null;
    if (incidents.length === 0) return null;
    const top = incidents.slice(0, 3).map((i) => localizedTitle(i, locale));
    return {
      title:
        locale === "pl"
          ? `${incidents.length} incydentów na mapie`
          : `${incidents.length} mapped incidents`,
      body: top.join(" · "),
    };
  }, [briefTitle, briefBody, incidents, locale]);

  return (
    <div className="flex flex-col">
      <section className="relative h-[50vh] min-h-[280px] w-full border-b border-white/10">
        <WarMap
          geojsonUrl={geojsonUrl}
          locale={locale}
          selectedId={selectedId}
          onSelect={setSelectedId}
          initialViewState={mapView}
          className="absolute inset-0 h-full w-full"
          emptyLabel={d.emptyDay}
        />
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider text-stone-300 md:left-4">
          <span className="text-stone-500">{d.legend}</span>
          {LEGEND_TYPES.map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: LEGEND_COLORS[type] }}
              />
              {typeLabel(type, locale)}
            </span>
          ))}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <section className="mb-10 max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
            {d.dayBrief}
          </h2>
          {incidents.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              {d.emptyDay} {d.emptyDayHint}
            </p>
          ) : (
            <article className="mt-3 space-y-2 text-stone-200">
              <h3 className="text-xl font-medium text-[#f3efe6]">
                {briefTitle ?? synthesized?.title}
              </h3>
              {(briefBody || synthesized?.body) && (
                <p className="leading-relaxed text-stone-300">
                  {briefBody ?? synthesized?.body}
                </p>
              )}
              {briefPoints && briefPoints.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-stone-400">
                  {briefPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
            {d.incidents}
          </h2>
          <ul className="space-y-3">
            {incidents.map((incident) => {
              const active = selectedId === incident.id;
              const title = localizedTitle(incident, locale);
              const summary = localizedSummary(incident, locale);
              return (
                <li key={incident.id}>
                  <button
                    type="button"
                    id={`incident-${incident.id}`}
                    onClick={() => setSelectedId(incident.id)}
                    className={`w-full border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#c4a35a]/70 bg-[#c4a35a]/10"
                        : "border-white/10 bg-black/20 hover:border-white/25"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-widest text-stone-500">
                      {formatTime(incident.occurred_at, locale)} ·{" "}
                      {typeLabel(incident.type, locale)} ·{" "}
                      {confidenceLabel(incident.confidence, locale)}
                    </p>
                    <p className="mt-1 font-medium text-stone-100">{title}</p>
                    {summary && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-400">
                        {summary}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
