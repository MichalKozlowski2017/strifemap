"use client";

import { useEffect, useMemo, useState } from "react";
import { MapControls } from "@/components/map/map-controls";
import { NewsImage } from "@/components/news/news-image";
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
import {
  articleSummaryForLocale,
  type DayNewsCard,
} from "@/lib/news/items";
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
  article_summary_pl?: string | null;
  article_summary_en?: string | null;
  image_url?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  theater_name_pl?: string;
  theater_name_en?: string;
  country_iso?: string | null;
};

function plIncidentCount(n: number): string {
  if (n === 1) return "1 incydent";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${n} incydenty`;
  }
  return `${n} incydentów`;
}

type Props = {
  locale: Locale;
  date: string;
  geojsonUrl: string;
  enabledTypes?: Set<IncidentType>;
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

  const activeOpenId =
    openId && incidents.some((i) => i.id === openId) ? openId : null;

  useEffect(() => {
    if (!activeOpenId) return;
    const el = document.getElementById(`incident-${activeOpenId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeOpenId]);

  const synthesized = useMemo(() => {
    if (briefTitle || briefBody) return null;
    if (incidents.length === 0) return null;
    const n = incidents.length;
    const top = incidents.slice(0, 3).map((i) => localizedTitle(i, locale));
    return {
      title:
        locale === "pl"
          ? `${plIncidentCount(n)} na mapie`
          : `${n} mapped incident${n === 1 ? "" : "s"}`,
      body: top.join(" · "),
    };
  }, [briefTitle, briefBody, incidents, locale]);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  const incidentList =
    incidents.length === 0 ? null : (
      <section>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--accent)]">
          {d.incidents}
        </h2>
        <ul className="space-y-3">
          {incidents.map((incident) => {
            const open = activeOpenId === incident.id;
            const title = localizedTitle(incident, locale);
            const teaser = localizedSummary(incident, locale);
            const articleBody = articleSummaryForLocale(
              {
                article_summary_pl: incident.article_summary_pl ?? null,
                article_summary_en: incident.article_summary_en ?? null,
                summary_pl: incident.summary_pl ?? null,
                summary_en: incident.summary_en ?? null,
                summary: incident.summary ?? null,
                body: null,
              },
              locale,
            );
            const image = incident.image_url?.trim() || "";
            const sourceName = incident.source_name?.trim() || "";
            const sourceUrl = incident.source_url?.trim() || "";
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
                    {!open && teaser ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                        {teaser}
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
                        {image ? (
                          <NewsImage
                            src={image}
                            alt={title}
                            aspect="wide"
                            className="mb-4 w-full border border-[var(--border)]"
                            required
                          />
                        ) : null}

                        {sourceName ? (
                          <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                            {sourceName}
                          </p>
                        ) : null}

                        {articleBody ? (
                          <p
                            data-wn-article-body
                            className="text-sm leading-relaxed text-[var(--muted)] md:text-[15px]"
                          >
                            {articleBody}
                          </p>
                        ) : null}

                        {sourceUrl ? (
                          <p className="mt-4">
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center border border-[var(--border-strong)] px-4 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                            >
                              {d.newsReadSource}
                              {sourceName ? ` (${sourceName})` : ""}
                            </a>
                          </p>
                        ) : null}

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

  const briefEmpty = incidents.length === 0;

  return (
    <div className="flex flex-col">
      <section className="relative h-[50vh] min-h-[280px] w-full border-b border-[var(--border)] md:min-h-[320px]">
        <WarMap
          geojsonUrl={geojsonUrl}
          locale={locale}
          enabledTypes={enabledTypes}
          selectedId={activeOpenId}
          onSelect={setOpenId}
          onPinCount={setPinCount}
          initialViewState={mapView}
          className="absolute inset-0 h-full w-full"
          emptyLabel={d.mapEmptyRange}
        />
        <div className="md:hidden">
          <MapControls locale={locale} pinCount={pinCount} mapOnly />
        </div>
        <div className="hidden md:block">
          <MapControls locale={locale} pinCount={pinCount} />
        </div>
      </section>

      <MapControls locale={locale} pinCount={pinCount} belowMap />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <section className="mb-10 max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--accent)]">
            {d.dayBrief}
          </h2>
          {briefEmpty ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {`${d.emptyDay} ${d.emptyDayHint}`}
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
          <NewsWall
            locale={locale}
            date={date}
            items={news}
            className="hidden lg:block lg:sticky lg:top-28"
          />
        </div>

        <NewsWall
          locale={locale}
          date={date}
          items={news}
          className="mt-12 border-t border-[var(--border)] pt-10 lg:hidden"
        />
      </div>
    </div>
  );
}
