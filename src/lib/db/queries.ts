import { getDb } from "@/lib/db/client";
import type { Brief, Incident, Source, Theater } from "@/lib/types";
import { computeMapEligible } from "@/lib/ai/quality";
import { nowIso } from "@/lib/utils/id";

/** libSQL Row instances carry methods — strip them for RSC → client props. */
function plainRows<T>(rows: readonly unknown[]): T[] {
  return JSON.parse(JSON.stringify(rows)) as T[];
}

function plainRow<T>(row: unknown | undefined): T | null {
  if (row == null) return null;
  return JSON.parse(JSON.stringify(row)) as T;
}

export type SourceWithTheater = Source & { theater_slug: string | null };

export type PendingRawRow = {
  id: string;
  title: string;
  url: string;
  status: string;
  fetched_at: string;
  source_name: string;
};

export type ReviewIncidentRow = Incident & {
  theater_slug: string;
  name_pl: string;
  source_count: number;
};

export async function listTheaters(): Promise<Theater[]> {
  const db = getDb();
  const r = await db.execute(`SELECT * FROM theaters ORDER BY sort ASC`);
  return plainRows<Theater>(r.rows);
}

export async function getTheaterBySlug(slug: string): Promise<Theater | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT * FROM theaters WHERE slug = ?`,
    args: [slug],
  });
  return plainRow<Theater>(r.rows[0]);
}

export async function listIncidentsForTheater(
  theaterId: string,
  limit = 40,
): Promise<Incident[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT * FROM incidents
      WHERE theater_id = ? AND status IN ('approved', 'published', 'pending')
      ORDER BY occurred_at DESC
      LIMIT ?
    `,
    args: [theaterId, limit],
  });
  return plainRows<Incident>(r.rows);
}

export async function latestBrief(
  theaterId: string,
  kind = "daily_sitrep",
): Promise<Brief | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT * FROM briefs
      WHERE theater_id = ? AND kind = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [theaterId, kind],
  });
  return plainRow<Brief>(r.rows[0]);
}

export async function getBriefForDate(
  theaterId: string,
  dateISO: string,
  kind = "daily_sitrep",
): Promise<Brief | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT * FROM briefs
      WHERE theater_id = ? AND kind = ? AND for_date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [theaterId, kind, dateISO],
  });
  return plainRow<Brief>(r.rows[0]);
}

export async function listSources(): Promise<SourceWithTheater[]> {
  const db = getDb();
  const r = await db.execute(`
    SELECT s.*, t.slug AS theater_slug
    FROM sources s
    LEFT JOIN theaters t ON t.id = s.theater_id
    ORDER BY s.name
  `);
  return plainRows<SourceWithTheater>(r.rows);
}

export async function listPendingRaw(limit = 50): Promise<PendingRawRow[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT r.id, r.title, r.url, r.status, r.fetched_at, s.name AS source_name
      FROM raw_events r
      JOIN sources s ON s.id = r.source_id
      ORDER BY r.fetched_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return plainRows<PendingRawRow>(r.rows);
}

export async function listReviewIncidents(
  limit = 50,
): Promise<ReviewIncidentRow[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT i.*, t.slug AS theater_slug, t.name_pl,
        (SELECT COUNT(*) FROM incident_sources isrc WHERE isrc.incident_id = i.id) AS source_count
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      ORDER BY
        CASE i.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        i.updated_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return plainRows<ReviewIncidentRow>(r.rows);
}

export async function setSourceEnabled(id: string, enabled: boolean) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE sources SET enabled = ? WHERE id = ?`,
    args: [enabled ? 1 : 0, id],
  });
}

export async function setIncidentStatus(
  id: string,
  status: "approved" | "rejected" | "published" | "pending",
) {
  const db = getDb();
  const row = await db.execute({
    sql: `SELECT confidence, lat, lng FROM incidents WHERE id = ?`,
    args: [id],
  });
  if (!row.rows.length) return;

  const src = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM incident_sources WHERE incident_id = ?`,
    args: [id],
  });
  const sourceCount = Number(src.rows[0].c);
  const confidence = String(row.rows[0].confidence) as
    | "confirmed"
    | "reported"
    | "unverified";
  const lat = row.rows[0].lat as number | null;
  const lng = row.rows[0].lng as number | null;

  let mapEligible = 0;
  if (status === "approved" || status === "published") {
    mapEligible = computeMapEligible({ confidence, lat, lng, sourceCount })
      ? 1
      : 0;
  }

  await db.execute({
    sql: `UPDATE incidents SET status = ?, map_eligible = ?, updated_at = ? WHERE id = ?`,
    args: [status, mapEligible, nowIso(), id],
  });
}
