"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CountryCard } from "@/components/country/country-card";
import { MapControls } from "@/components/map/map-controls";
import { NewsWall } from "@/components/news/news-wall";
import { WarMap } from "@/components/map/war-map";
import {
  confidenceLabel,
  localizedSummary,
  localizedTitle,
  typeLabel,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { formatTime } from "@/lib/dates";
import type { CountryDayChip } from "@/lib/geo/incidents";
import type { DayNewsCard } from "@/lib/news/items";
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
  country_iso?: string | null;
};

type SourceRow = {
  url?: string | null;
  title?: string | null;
  source_name?: string | null;
};

function subscribeMq(cb: () => void) {
  const mq = window.matchMedia("(max-width: 1023px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function isMobileMq() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

type Props = {
  locale: Locale;
  date: string;
  geojsonUrl: string;
  enabledTypes?: Set<IncidentType>;
  selectedCountry?: string | null;
  onSelectCountry?: (iso: string | null) => void;
  countries?: CountryDayChip[];
  incidents: DayIncidentCard[];
  news?: DayNewsCard[];
  briefTitle?: string | null;
  briefBody?: string | null;
  briefPoints?: string[];
  mapView?: { longitude: number; latitude: number; zoom: number };
};

export function DayReader({
  locale,
  date,
  geojsonUrl,
  enabledTypes,
  selectedCountry = null,
  onSelectCountry,
  countries = [],
  incidents,
  news = [],
  briefTitle,
  briefBody,
  briefPoints,
  mapView,
}: Props) {
  const d = t(locale);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinCount, setPinCount] = useState<number | null>(null);
  const countryCardRef = useRef<HTMLDivElement>(null);
  const isMobile = useSyncExternalStore(subscribeMq, isMobileMq, () => false);
  const [sourcesById, setSourcesById] = useState<
    Record<string, SourceRow[] | "loading">
  >({});

  const countryIncidents = useMemo(() => {
    if (!selectedCountry) return [];
    return incidents.filter(
      (i) => i.country_iso?.toUpperCase() === selectedCountry,
    );
  }, [incidents, selectedCountry]);

  const countryNews = useMemo(() => {
    if (!selectedCountry) return [];
    return news.filter((n) => n.country_iso?.toUpperCase() === selectedCountry);
  }, [news, selectedCountry]);

  useEffect(() => {
    if (!selectedCountry || !isMobile) return;
    countryCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedCountry, isMobile]);

  useEffect(() => {
    if (!openId) return;
    const el = document.getElementById(`incident-${openId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    if (Array.isArray(sourcesById[openId])) return;

    let cancelled = false;
    fetch(`/api/incidents/${openId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        setSourcesById((prev) => ({
          ...prev,
          [openId]: (body?.sources ?? []) as SourceRow[],
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setSourcesById((prev) => ({ ...prev, [openId]: [] }));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const synthesized = useMemo(() => {
    if (briefTitle || briefBody) return null;
    if (incidents.length === 0) return null;
    const n = incidents.length;
    const top = incidents.slice(0, 3).map((i) => localizedTitle(i, locale));
    const plCount =
      n === 1
        ? "1 incydent"
        : (() => {
            const mod10 = n % 10;
            const mod100 = n % 100;
            if (
              mod10 >= 2 &&
              mod10 <= 4 &&
              !(mod100 >= 12 && mod100 <= 14)
            ) {
              return `${n} incydenty`;
            }
            return `${n} incydentów`;
          })();
    return {
      title:
        locale === "pl"
          ? `${plCount} na mapie`
          : `${n} mapped incident${n === 1 ? "" : "s"}`,
      body: top.join(" · "),
    };
  }, [briefTitle, briefBody, incidents, locale]);

  function toggle(id: string) {
    setOpenId((prev) => {
      if (prev === id) return null;
      setSourcesById((s) =>
        Array.isArray(s[id]) || s[id] === "loading"
          ? s
          : { ...s, [id]: "loading" },
      );
      return id;
    });
  }

  const incidentList = (
    <section>
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--accent)]">
        {d.incidents}
      </h2>
      <ul className="space-y-3">
        {incidents.map((incident) => {
          const open = openId === incident.id;
          const title = localizedTitle(incident, locale);
          const summary = localizedSummary(incident, locale);
          const sources = sourcesById[incident.id];
          return (
            <li key={incident.id}>
              <div
                id={`incident-${incident.id}`}
                className={`border transition ${
                  open
                    ? "border-[var(--border-strong)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(incident.id)}
                  aria-expanded={open}
                  className="w-full px-4 py-3 text-left"
                >
                  <p className="text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                    {formatTime(incident.occurred_at, locale)} ·{" "}
                    {typeLabel(incident.type, locale)} ·{" "}
                    {confidenceLabel(incident.confidence, locale)}
                  </p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {title}
                  </p>
                  {!open && summary ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                      {summary}
                    </p>
                  ) : null}
                </button>

                <div
                  className="wn-accordion"
                  data-open={open ? "true" : "false"}
                  aria-hidden={!open}
                >
                  <div className="wn-accordion__inner">
                    <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                      {summary ? (
                        <p className="text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">
                          {summary}
                        </p>
                      ) : null}
                      <div className="mt-4">
                        <p className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
                          {d.sources}
                        </p>
                        {sources === "loading" || sources === undefined ? (
                          <p className="mt-2 text-xs text-[var(--muted-2)]">…</p>
                        ) : sources.length === 0 ? (
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {d.noSources}
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2 text-sm">
                            {sources.map((s, idx) => {
                              const name = s.source_name?.trim() || "Source";
                              const original = s.title?.trim();
                              const href = s.url?.trim();
                              const label = original
                                ? `${name}: ${original}`
                                : name;
                              return (
                                <li key={`${href ?? name}-${idx}`}>
                                  {href ? (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex min-h-10 items-center text-[var(--accent)] underline-offset-2 hover:underline"
                                    >
                                      {label}
                                    </a>
                                  ) : (
                                    <span className="text-[var(--muted)]">
                                      {label}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="mt-3 text-[11px] uppercase tracking-widest text-[var(--muted-2)] hover:text-[var(--accent)]"
                      >
                        {d.close}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const countryCard =
    selectedCountry && onSelectCountry ? (
      <CountryCard
        locale={locale}
        date={date}
        iso={selectedCountry}
        incidents={countryIncidents}
        news={countryNews}
        onClear={() => onSelectCountry(null)}
        onSelectIncident={setOpenId}
      />
    ) : null;

  return (
    <div className="flex flex-col">
      <section className="relative h-[50vh] min-h-[280px] w-full border-b border-[var(--border)]">
        <WarMap
          geojsonUrl={geojsonUrl}
          locale={locale}
          enabledTypes={enabledTypes}
          selectedId={openId}
          selectedCountry={selectedCountry}
          onSelect={setOpenId}
          onSelectCountry={onSelectCountry}
          onPinCount={setPinCount}
          initialViewState={mapView}
          className="absolute inset-0 h-full w-full"
          emptyLabel={d.mapEmptyRange}
        />
        <MapControls
          locale={locale}
          pinCount={pinCount}
          countries={countries}
        />
      </section>

      {countryCard && isMobile ? (
        <div
          ref={countryCardRef}
          className="border-b border-[var(--border)] px-4 py-4"
        >
          {countryCard}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <section className="mb-10 max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--accent)]">
            {d.dayBrief}
          </h2>
          {incidents.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {d.emptyDay} {d.emptyDayHint}
            </p>
          ) : (
            <article className="mt-3 space-y-2">
              <h3 className="text-xl font-medium text-[var(--foreground)]">
                {briefTitle ?? synthesized?.title}
              </h3>
              {(briefBody || synthesized?.body) && (
                <p className="leading-relaxed text-[var(--muted)]">
                  {briefBody ?? synthesized?.body}
                </p>
              )}
              {briefPoints && briefPoints.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {briefPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
          {incidentList}
          {countryCard && !isMobile ? (
            <div className="lg:sticky lg:top-28">{countryCard}</div>
          ) : !countryCard ? (
            <NewsWall
              locale={locale}
              date={date}
              items={news}
              className="hidden lg:block lg:sticky lg:top-28"
            />
          ) : null}
        </div>

        {!selectedCountry ? (
          <NewsWall
            locale={locale}
            date={date}
            items={news}
            className="mt-12 border-t border-[var(--border)] pt-10 lg:hidden"
          />
        ) : null}
      </div>
    </div>
  );
}
