import { getDb } from "@/lib/db/client";
import { getOpenAI, hasOpenAI, modelName } from "@/lib/ai/client";
import { incidentExtractSchema } from "@/lib/ai/schemas";
import { computeMapEligible } from "@/lib/ai/quality";
import type { Confidence, IncidentType } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils/id";

const SYSTEM = `You extract structured conflict/security incidents from news items.
Return JSON only matching the schema. Do not invent facts.
If the item is not about a conflict/security/military/hybrid event, set is_incident=false.
Prefer real coordinates when the place is clear; otherwise lat/lng null.
theater_slug must be one of: ukraine-russia, middle-east, africa, indo-pacific, europe-hybrid, americas.
europe-hybrid is for sabotage, hybrid, critical infrastructure attacks in Europe outside the UA front.
merge_hint: short normalized key for the same story (place + event), or null.`;

type PendingRow = {
  id: string;
  title: string;
  body: string | null;
  url: string;
  theater_id: string | null;
  theater_slug: string | null;
};

export async function extractIncidents(limit = 15): Promise<{
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  skippedNoKey: boolean;
}> {
  if (!hasOpenAI()) {
    return {
      processed: 0,
      created: 0,
      merged: 0,
      skipped: 0,
      skippedNoKey: true,
    };
  }

  const openai = getOpenAI()!;
  const db = getDb();

  const pending = await db.execute({
    sql: `
      SELECT r.id, r.title, r.body, r.url, s.theater_id, t.slug AS theater_slug
      FROM raw_events r
      JOIN sources s ON s.id = r.source_id
      LEFT JOIN theaters t ON t.id = s.theater_id
      WHERE r.status = 'pending' AND r.body IS NOT NULL
      ORDER BY r.fetched_at ASC
      LIMIT ?
    `,
    args: [limit],
  });

  const rows = pending.rows as unknown as PendingRow[];
  let created = 0;
  let merged = 0;
  let skipped = 0;

  const theaters = await db.execute(`SELECT id, slug FROM theaters`);
  const slugToId = new Map(
    theaters.rows.map((t) => [String(t.slug), String(t.id)]),
  );

  for (const row of rows) {
    try {
      const completion = await openai.chat.completions.create({
        model: modelName(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              title: row.title,
              body: row.body?.slice(0, 3500) ?? "",
              url: row.url,
              suggested_theater: row.theater_slug,
            }),
          },
        ],
      });

      const rawText = completion.choices[0]?.message?.content ?? "{}";
      const parsed = incidentExtractSchema.safeParse(JSON.parse(rawText));

      if (!parsed.success || !parsed.data.is_incident) {
        await markRaw(row.id, "skipped");
        skipped += 1;
        continue;
      }

      const data = parsed.data;
      const theaterId =
        (data.theater_slug && slugToId.get(data.theater_slug)) ||
        row.theater_id ||
        slugToId.get("europe-hybrid")!;

      // Merge hint: same title-ish within 48h in same theater
      const mergeKey = (data.merge_hint || data.title)
        .toLowerCase()
        .slice(0, 80);
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const existing = await db.execute({
        sql: `
          SELECT id, confidence FROM incidents
          WHERE theater_id = ?
            AND occurred_at >= ?
            AND lower(title) LIKE ?
          LIMIT 1
        `,
        args: [theaterId, since, `%${mergeKey.slice(0, 40)}%`],
      });

      if (existing.rows.length > 0) {
        const incidentId = String(existing.rows[0].id);
        await db.execute({
          sql: `INSERT OR IGNORE INTO incident_sources (incident_id, raw_event_id) VALUES (?, ?)`,
          args: [incidentId, row.id],
        });
        const srcCount = await db.execute({
          sql: `SELECT COUNT(*) AS c FROM incident_sources WHERE incident_id = ?`,
          args: [incidentId],
        });
        const count = Number(srcCount.rows[0].c);
        const confidence = String(existing.rows[0].confidence) as Confidence;
        const inc = await db.execute({
          sql: `SELECT lat, lng, status FROM incidents WHERE id = ?`,
          args: [incidentId],
        });
        const lat = inc.rows[0].lat as number | null;
        const lng = inc.rows[0].lng as number | null;
        const eligible = computeMapEligible({
          confidence,
          lat,
          lng,
          sourceCount: count,
        })
          ? 1
          : 0;
        await db.execute({
          sql: `UPDATE incidents SET map_eligible = ?, updated_at = ? WHERE id = ?`,
          args: [eligible, nowIso(), incidentId],
        });
        await markRaw(row.id, "processed");
        merged += 1;
        continue;
      }

      const incidentId = newId();
      const occurred =
        data.occurred_at && !Number.isNaN(Date.parse(data.occurred_at))
          ? new Date(data.occurred_at).toISOString()
          : nowIso();
      const sourceCount = 1;
      const mapEligible = computeMapEligible({
        confidence: data.confidence,
        lat: data.lat,
        lng: data.lng,
        sourceCount,
      })
        ? 1
        : 0;

      // AI proposals stay pending for human review unless map-ready & confirmed
      const status =
        mapEligible && data.confidence === "confirmed" ? "approved" : "pending";

      await db.batch(
        [
          {
            sql: `INSERT INTO incidents (
              id, theater_id, type, title, summary, lat, lng, occurred_at,
              confidence, status, map_eligible, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              incidentId,
              theaterId,
              data.type as IncidentType,
              data.title,
              data.summary,
              data.lat,
              data.lng,
              occurred,
              data.confidence,
              status,
              mapEligible,
              nowIso(),
              nowIso(),
            ],
          },
          {
            sql: `INSERT INTO incident_sources (incident_id, raw_event_id) VALUES (?, ?)`,
            args: [incidentId, row.id],
          },
        ],
        "write",
      );

      await markRaw(row.id, "processed");
      created += 1;
    } catch (err) {
      console.error("Extract failed for", row.id, err);
      await markRaw(row.id, "error");
      skipped += 1;
    }
  }

  return {
    processed: rows.length,
    created,
    merged,
    skipped,
    skippedNoKey: false,
  };
}

async function markRaw(
  id: string,
  status: "processed" | "skipped" | "error",
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE raw_events SET status = ?, processed_at = ? WHERE id = ?`,
    args: [status, nowIso(), id],
  });
}
