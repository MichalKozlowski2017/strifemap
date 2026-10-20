import { getDb } from "@/lib/db/client";
import { dayBoundsISO, formatDateISO, todayISO } from "@/lib/dates";
import type { MapIncidentFeatureProps } from "@/lib/types";
import type { FeatureCollection, Point } from "geojson";

export async function getLatestMapDate(theaterSlug?: string): Promise<string> {
  const db = getDb();
  const args: string[] = [];
  let theaterClause = "";
  if (theaterSlug) {
    theaterClause = "AND t.slug = ?";
    args.push(theaterSlug);
  }

  const result = await db.execute({
    sql: `
      SELECT i.occurred_at
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE i.map_eligible = 1
        AND i.status IN ('approved', 'published')
        AND i.lat IS NOT NULL AND i.lng IS NOT NULL
        ${theaterClause}
      ORDER BY i.occurred_at DESC
      LIMIT 1
    `,
    args,
  });

  if (!result.rows.length) return todayISO();
  return formatDateISO(new Date(String(result.rows[0].occurred_at)));
}

export async function getMapGeoJSON(options?: {
  date?: string;
  hours?: number;
  theaterSlug?: string;
}): Promise<FeatureCollection<Point, MapIncidentFeatureProps>> {
  const db = getDb();
  const args: (string | number)[] = [];
  const clauses: string[] = [
    "i.map_eligible = 1",
    "i.status IN ('approved', 'published')",
    "i.lat IS NOT NULL AND i.lng IS NOT NULL",
  ];

  if (options?.date) {
    const bounds = dayBoundsISO(options.date);
    if (bounds) {
      clauses.push("i.occurred_at >= ? AND i.occurred_at <= ?");
      args.push(bounds.start, bounds.end);
    }
  } else {
    const hours = options?.hours ?? 72;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    clauses.push("i.occurred_at >= ?");
    args.push(since);
  }

  if (options?.theaterSlug) {
    clauses.push("t.slug = ?");
    args.push(options.theaterSlug);
  }

  const result = await db.execute({
    sql: `
      SELECT i.id, i.title, i.summary, i.title_pl, i.title_en, i.summary_pl, i.summary_en,
             i.type, i.confidence, i.lat, i.lng, i.occurred_at,
             t.slug AS theater_slug, t.name_pl AS theater_name_pl, t.name_en AS theater_name_en
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY i.occurred_at DESC
      LIMIT 500
    `,
    args,
  });

  return {
    type: "FeatureCollection",
    features: result.rows.map((row) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(row.lng), Number(row.lat)],
      },
      properties: {
        id: String(row.id),
        title: String(row.title),
        summary: String(row.summary),
        title_pl: row.title_pl != null ? String(row.title_pl) : null,
        title_en: row.title_en != null ? String(row.title_en) : null,
        summary_pl: row.summary_pl != null ? String(row.summary_pl) : null,
        summary_en: row.summary_en != null ? String(row.summary_en) : null,
        type: row.type as MapIncidentFeatureProps["type"],
        confidence: row.confidence as MapIncidentFeatureProps["confidence"],
        theater_slug: String(row.theater_slug),
        theater_name_pl: String(row.theater_name_pl),
        theater_name_en: String(row.theater_name_en),
        occurred_at: String(row.occurred_at),
      },
    })),
  };
}

export async function listIncidentsForDate(options: {
  date: string;
  theaterSlug?: string;
  mapEligibleOnly?: boolean;
}) {
  const bounds = dayBoundsISO(options.date);
  if (!bounds) return [];

  const db = getDb();
  const args: (string | number)[] = [bounds.start, bounds.end];
  const clauses = ["i.occurred_at >= ?", "i.occurred_at <= ?"];

  if (options.mapEligibleOnly !== false) {
    clauses.push("i.map_eligible = 1");
    clauses.push("i.status IN ('approved', 'published')");
  } else {
    clauses.push("i.status IN ('approved', 'published', 'pending')");
  }

  if (options.theaterSlug) {
    clauses.push("t.slug = ?");
    args.push(options.theaterSlug);
  }

  const result = await db.execute({
    sql: `
      SELECT i.*, t.slug AS theater_slug, t.name_pl, t.name_en
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY i.occurred_at DESC
      LIMIT 200
    `,
    args,
  });

  return JSON.parse(JSON.stringify(result.rows)) as Record<string, unknown>[];
}

/** Conflict items for the News feed — same day as map, but not map pins. */
export type NewsItemRow = {
  id: string;
  occurred_at: string;
  title: string | null;
  summary: string | null;
  title_pl: string | null;
  title_en: string | null;
  summary_pl: string | null;
  summary_en: string | null;
  type: string;
  confidence: string;
  theater_slug: string;
  source_name: string | null;
  source_url: string | null;
  trust_weight: number;
  source_count: number;
  image_url: string | null;
  body: string | null;
};

export async function listNewsForDate(options: {
  date: string;
  theaterSlug?: string;
  limit?: number;
}): Promise<NewsItemRow[]> {
  const bounds = dayBoundsISO(options.date);
  if (!bounds) return [];

  const db = getDb();
  const args: (string | number)[] = [bounds.start, bounds.end];
  const clauses = [
    "i.occurred_at >= ?",
    "i.occurred_at <= ?",
    "i.map_eligible = 0",
    "i.status IN ('approved', 'published', 'pending')",
  ];

  if (options.theaterSlug) {
    clauses.push("t.slug = ?");
    args.push(options.theaterSlug);
  }

  const limit = options.limit ?? 40;
  args.push(limit);

  const result = await db.execute({
    sql: `
      SELECT i.id, i.occurred_at, i.title, i.summary,
             i.title_pl, i.title_en, i.summary_pl, i.summary_en, i.type,
             i.confidence,
             t.slug AS theater_slug,
             COALESCE(i.image_url, (
               SELECT r.image_url FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               WHERE isrc.incident_id = i.id AND r.image_url IS NOT NULL
               LIMIT 1
             )) AS image_url,
             (
               SELECT r.body FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               WHERE isrc.incident_id = i.id
               ORDER BY length(COALESCE(r.body,'')) DESC
               LIMIT 1
             ) AS body,
             (
               SELECT s.name FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
               ORDER BY s.trust_weight DESC
               LIMIT 1
             ) AS source_name,
             (
               SELECT r.url FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
               ORDER BY s.trust_weight DESC
               LIMIT 1
             ) AS source_url,
             (
               SELECT COALESCE(MAX(s.trust_weight), 1.0) FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
             ) AS trust_weight,
             (
               SELECT COUNT(*) FROM incident_sources isrc
               WHERE isrc.incident_id = i.id
             ) AS source_count
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY i.occurred_at DESC
      LIMIT ?
    `,
    args,
  });

  return JSON.parse(JSON.stringify(result.rows)) as NewsItemRow[];
}

export async function getIncidentWithSources(id: string) {
  const db = getDb();
  const inc = await db.execute({
    sql: `
      SELECT i.*, t.slug AS theater_slug, t.name_pl, t.name_en
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE i.id = ?
    `,
    args: [id],
  });
  if (!inc.rows.length) return null;

  const sources = await db.execute({
    sql: `
      SELECT r.url, r.title, s.name AS source_name
      FROM incident_sources isrc
      JOIN raw_events r ON r.id = isrc.raw_event_id
      JOIN sources s ON s.id = r.source_id
      WHERE isrc.incident_id = ?
    `,
    args: [id],
  });

  return {
    incident: plainRow(inc.rows[0]),
    sources: sources.rows.map((r) => plainRow(r)),
  };
}

function plainRow(row: unknown) {
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}
