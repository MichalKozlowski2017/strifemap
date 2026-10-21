import type { IncidentType } from "@/lib/types";

export const INCIDENT_TYPES: IncidentType[] = [
  "kinetic",
  "air",
  "sabotage",
  "cyber",
  "naval",
  "diplomatic",
  "other",
];

/** Pins newer than this get a restrained pulse (within the selected day). */
export const FRESH_HOURS = 6;

export function parseLayers(raw: string | null | undefined): Set<IncidentType> {
  if (!raw?.trim()) return new Set(INCIDENT_TYPES);
  if (raw.trim() === "none") return new Set();
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as IncidentType[];
  const next = new Set<IncidentType>();
  for (const p of parts) {
    if ((INCIDENT_TYPES as string[]).includes(p)) next.add(p);
  }
  return next.size > 0 ? next : new Set(INCIDENT_TYPES);
}

export function layersToParam(enabled: Set<IncidentType>): string | null {
  if (enabled.size >= INCIDENT_TYPES.length) return null;
  if (enabled.size === 0) return "none";
  return INCIDENT_TYPES.filter((t) => enabled.has(t)).join(",");
}

export function parseCountryIso(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const iso = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(iso) ? iso : null;
}

export function buildGeojsonUrl(options: {
  date: string;
  theaterSlug?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("date", options.date);
  if (options.theaterSlug) params.set("theater", options.theaterSlug);
  return `/api/geojson?${params.toString()}`;
}
