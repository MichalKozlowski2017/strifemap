"use client";

import { useEffect, useState } from "react";
import {
  confidenceLabel,
  localizedSummary,
  localizedTitle,
  typeLabel,
} from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { formatTime } from "@/lib/dates";
import type { DayIncidentCard } from "@/components/day/day-reader";

type SourceRow = {
  url?: string | null;
  title?: string | null;
  source_name?: string | null;
};

export function IncidentDetailPanel({
  locale,
  incident,
  onClose,
}: {
  locale: Locale;
  incident: DayIncidentCard;
  onClose: () => void;
}) {
  const d = t(locale);
  const [sources, setSources] = useState<SourceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/incidents/${incident.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (!body) {
          setSources([]);
          return;
        }
        setSources((body.sources ?? []) as SourceRow[]);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [incident.id]);

  const title = localizedTitle(incident, locale);
  const summary = localizedSummary(incident, locale);

  return (
    <aside
      className="border border-[#c4a35a]/70 bg-[#121820] p-4 shadow-[0_0_0_1px_rgba(196,163,90,0.15)]"
      aria-label={d.details}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-widest text-stone-500">
          {formatTime(incident.occurred_at, locale)} ·{" "}
          {typeLabel(incident.type, locale)} ·{" "}
          {confidenceLabel(incident.confidence, locale)}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[11px] uppercase tracking-widest text-stone-500 hover:text-[#c4a35a]"
        >
          {d.close}
        </button>
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[#f3efe6]">
        {title}
      </h3>
      {summary && (
        <p className="mt-3 text-sm leading-relaxed text-stone-300">{summary}</p>
      )}
      <div className="mt-5 border-t border-white/10 pt-3">
        <p className="text-[10px] uppercase tracking-widest text-[#c4a35a]">
          {d.sources}
        </p>
        {sources === null ? (
          <p className="mt-2 text-xs text-stone-600">…</p>
        ) : sources.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">{d.noSources}</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {sources.map((s, idx) => {
              const name = s.source_name?.trim() || "Source";
              const original = s.title?.trim();
              const href = s.url?.trim();
              const label = original ? `${name}: ${original}` : name;
              return (
                <li key={`${href ?? name}-${idx}`} className="text-stone-300">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#c4a35a] underline-offset-2 hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    <span>{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
