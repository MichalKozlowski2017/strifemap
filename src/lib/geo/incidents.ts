import { getDb } from "@/lib/db/client";
import type { MapIncidentFeatureProps } from "@/lib/types";
import type { FeatureCollection, Point } from "geojson";

const DEFAULT_HOURS = 72;

export async function getMapGeoJSON(options?: {
  hours?: number;
  theaterSlug?: string;
}): Promise<FeatureCollection<Point, MapIncidentFeatureProps>> {
  const hours = options?.hours ?? DEFAULT_HOURS;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const db = getDb();

  const args: (string | number)[] = [since];
  let theaterClause = "";
  if (options?.theaterSlug) {
    theaterClause = "AND t.slug = ?";
    args.push(options.theaterSlug);
  }

  const result = await db.execute({
    sql: `
      SELECT i.id, i.title, i.summary, i.type, i.confidence, i.lat, i.lng,
             i.occurred_at, t.slug AS theater_slug, t.name_pl AS theater_name_pl
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE i.map_eligible = 1
        AND i.status IN ('approved', 'published')
        AND i.lat IS NOT NULL AND i.lng IS NOT NULL
        AND i.occurred_at >= ?
        ${theaterClause}
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
        type: row.type as MapIncidentFeatureProps["type"],
        confidence: row.confidence as MapIncidentFeatureProps["confidence"],
        theater_slug: String(row.theater_slug),
        theater_name_pl: String(row.theater_name_pl),
        occurred_at: String(row.occurred_at),
      },
    })),
  };
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
    incident: inc.rows[0],
    sources: sources.rows,
  };
}
