import type { IncidentType } from "@/lib/types";

export const TIME_RANGES = ["24h", "3d", "7d"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const DEFAULT_TIME_RANGE: TimeRange = "7d";

export const INCIDENT_TYPES: IncidentType[] = [
  "kinetic",
  "air",
  "sabotage",
  "cyber",
  "naval",
  "diplomatic",
  "other",
];

const HOURS: Record<TimeRange, number> = {
  "24h": 24,
  "3d": 72,
  "7d": 168,
};

/** Pins newer than this get a restrained pulse. */
export const FRESH_HOURS = 6;

export function parseTimeRange(raw: string | null | undefined): TimeRange {
  if (raw && (TIME_RANGES as readonly string[]).includes(raw)) {
    return raw as TimeRange;
  }
  return DEFAULT_TIME_RANGE;
}

export function hoursForTimeRange(range: TimeRange): number {
  return HOURS[range];
}

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
  // Unknown garbage → show all rather than empty map by accident
  return next.size > 0 ? next : new Set(INCIDENT_TYPES);
}

export function layersToParam(enabled: Set<IncidentType>): string | null {
  if (enabled.size >= INCIDENT_TYPES.length) return null;
  if (enabled.size === 0) return "none";
  return INCIDENT_TYPES.filter((t) => enabled.has(t)).join(",");
}

export function buildGeojsonUrl(options: {
  timeRange: TimeRange;
  theaterSlug?: string | null;
}): string {
  const hours = hoursForTimeRange(options.timeRange);
  const params = new URLSearchParams();
  params.set("timeRange", options.timeRange);
  params.set("hours", String(hours));
  if (options.theaterSlug) params.set("theater", options.theaterSlug);
  return `/api/geojson?${params.toString()}`;
}
