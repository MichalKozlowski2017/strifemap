import { getDb } from "@/lib/db/client";
import { getOpenAI, hasOpenAI, modelName } from "@/lib/ai/client";
import { incidentExtractSchema } from "@/lib/ai/schemas";
import { computeMapEligible } from "@/lib/ai/quality";
import {
  distanceKm,
  titleSimilarity,
} from "@/lib/sources/normalize";
import type { Confidence, IncidentType } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils/id";

/** Title Jaccard threshold for merge within 48h. */
const MERGE_TITLE_THRESHOLD = 0.55;
/** Max distance (km) between coords to treat as same incident. */
const MERGE_DISTANCE_KM = 50;

const SYSTEM = `You extract structured conflict/security incidents from news items.
Return a single JSON object. Do not invent facts.
If the item is not about a conflict/security/military/hybrid event, return {"is_incident":false}.

When is_incident is true, use EXACTLY these fields and enums:
{
  "is_incident": true,
  "theater_slug": "ukraine-russia" | "middle-east" | "africa" | "indo-pacific" | "europe-hybrid" | "americas",
  "type": "kinetic" | "sabotage" | "cyber" | "air" | "naval" | "diplomatic" | "other",
  "title_pl": string,
  "title_en": string,
  "summary_pl": string,
  "summary_en": string,
  "lat": number | null,
  "lng": number | null,
  "occurred_at": ISO-8601 string | null,
  "confidence": "confirmed" | "reported" | "unverified",
  "merge_hint": string | null
}
Rules:
- Always provide BOTH Polish (title_pl, summary_pl) and English (title_en, summary_en).
- confidence must be one of those three strings (never a number).
- type must be one of the seven enums (use "air" for drones/missiles/aircraft; "kinetic" for ground fighting; "other" if unsure).
- theater_slug must be one of the six enums (Black Sea / Ukraine → ukraine-russia; Europe hybrid/sabotage → europe-hybrid).
- Prefer real coordinates when the place is clear; otherwise lat/lng null.
- merge_hint: short normalized key for the same story (place + event), or null.`;

function normalizeExtract(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };

  if (o.is_incident === false) return o;

  const typeMap: Record<string, string> = {
    military: "kinetic",
    "military conflict": "kinetic",
    conflict: "kinetic",
    ground: "kinetic",
    shelling: "kinetic",
    drone: "air",
    drones: "air",
    missile: "air",
    missiles: "air",
    airstrike: "air",
    aviation: "air",
    bombing: "air",
    ship: "naval",
    shipping: "naval",
    maritime: "naval",
    hack: "cyber",
    hacking: "cyber",
    ddos: "cyber",
    diplomacy: "diplomatic",
    sanctions: "diplomatic",
  };
  if (typeof o.type === "string") {
    const t = o.type.toLowerCase().trim();
    o.type = typeMap[t] ?? (t.includes("drone") || t.includes("missile") ? "air" : t);
  }

  if (typeof o.confidence === "number") {
    o.confidence =
      o.confidence >= 0.85
        ? "confirmed"
        : o.confidence >= 0.55
          ? "reported"
          : "unverified";
  } else if (typeof o.confidence === "string") {
    const c = o.confidence.toLowerCase();
    if (["high", "certain", "confirmed"].includes(c)) o.confidence = "confirmed";
    else if (["medium", "likely", "reported"].includes(c)) o.confidence = "reported";
    else if (["low", "unclear", "unverified"].includes(c)) o.confidence = "unverified";
  }

  const theaterMap: Record<string, string> = {
    "black-sea": "ukraine-russia",
    blacksea: "ukraine-russia",
    ukraine: "ukraine-russia",
    russia: "ukraine-russia",
    "middle east": "middle-east",
    gaza: "middle-east",
    israel: "middle-east",
    iran: "middle-east",
    lebanon: "middle-east",
    sudan: "africa",
    sahel: "africa",
    europe: "europe-hybrid",
    "baltic": "europe-hybrid",
    china: "indo-pacific",
    "south-china-sea": "indo-pacific",
    taiwan: "indo-pacific",
  };
  if (typeof o.theater_slug === "string") {
    const s = o.theater_slug.toLowerCase().trim();
    o.theater_slug = theaterMap[s] ?? s;
  }

  // Legacy single-lang model output → bilingual fields
  if (!o.title_pl && typeof o.title === "string") o.title_pl = o.title;
  if (!o.title_en && typeof o.title === "string") o.title_en = o.title;
  if (!o.summary_pl && typeof o.summary === "string") o.summary_pl = o.summary;
  if (!o.summary_en && typeof o.summary === "string") o.summary_en = o.summary;

  return o;
}

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
      const rawJson = JSON.parse(rawText) as { is_incident?: boolean };
      if (rawJson?.is_incident === false) {
        await markRaw(row.id, "skipped");
        skipped += 1;
        continue;
      }

      const parsed = incidentExtractSchema.safeParse(normalizeExtract(rawJson));

      if (!parsed.success || !parsed.data.is_incident) {
        if (!parsed.success) {
          console.warn(
            "Extract schema miss for",
            row.id,
            parsed.error.issues
              .map((i) => `${i.path.join(".")}:${i.message}`)
              .join("; "),
          );
        }
        await markRaw(row.id, "skipped");
        skipped += 1;
        continue;
      }

      const data = parsed.data;
      const theaterId =
        (data.theater_slug && slugToId.get(data.theater_slug)) ||
        row.theater_id ||
        slugToId.get("europe-hybrid")!;

      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const candidates = await db.execute({
        sql: `
          SELECT id, title, title_en, title_pl, summary, confidence, lat, lng
          FROM incidents
          WHERE theater_id = ? AND occurred_at >= ?
          ORDER BY occurred_at DESC
          LIMIT 80
        `,
        args: [theaterId, since],
      });

      const newTitle = data.title_en || data.title_pl;
      const hint = data.merge_hint?.trim().toLowerCase() ?? "";
      let matchId: string | null = null;
      let matchConfidence: Confidence | null = null;
      let matchLat: number | null = null;
      let matchLng: number | null = null;

      for (const cand of candidates.rows) {
        const candTitle = String(
          cand.title_en ?? cand.title_pl ?? cand.title ?? "",
        );
        const candId = String(cand.id);
        const sim = titleSimilarity(newTitle, candTitle);
        const dist = distanceKm(
          data.lat,
          data.lng,
          cand.lat as number | null,
          cand.lng as number | null,
        );

        const hintHit =
          hint.length >= 4 &&
          (candTitle.toLowerCase().includes(hint) ||
            String(cand.summary ?? "")
              .toLowerCase()
              .includes(hint) ||
            String(cand.title ?? "")
              .toLowerCase()
              .includes(hint));

        const titleHit = sim >= MERGE_TITLE_THRESHOLD;
        const geoHit = dist != null && dist <= MERGE_DISTANCE_KM;

        // Merge when: strong title match, OR merge_hint + (title OR geo), OR title + geo
        const shouldMerge =
          (titleHit && sim >= 0.72) ||
          (hintHit && (titleHit || geoHit || sim >= 0.4)) ||
          (titleHit && geoHit);

        if (shouldMerge) {
          matchId = candId;
          matchConfidence = String(cand.confidence) as Confidence;
          matchLat = cand.lat as number | null;
          matchLng = cand.lng as number | null;
          break;
        }
      }

      if (matchId) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO incident_sources (incident_id, raw_event_id) VALUES (?, ?)`,
          args: [matchId, row.id],
        });
        const srcCount = await db.execute({
          sql: `SELECT COUNT(*) AS c FROM incident_sources WHERE incident_id = ?`,
          args: [matchId],
        });
        const count = Number(srcCount.rows[0].c);
        const confidence = matchConfidence!;
        // Prefer filling missing coords from the new extract
        const lat = matchLat ?? data.lat;
        const lng = matchLng ?? data.lng;
        const eligible = computeMapEligible({
          confidence,
          lat,
          lng,
          sourceCount: count,
        })
          ? 1
          : 0;
        await db.execute({
          sql: `UPDATE incidents SET lat = COALESCE(lat, ?), lng = COALESCE(lng, ?),
            map_eligible = ?, updated_at = ? WHERE id = ?`,
          args: [data.lat, data.lng, eligible, nowIso(), matchId],
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
              id, theater_id, type, title, summary,
              title_pl, title_en, summary_pl, summary_en,
              lat, lng, occurred_at,
              confidence, status, map_eligible, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              incidentId,
              theaterId,
              data.type as IncidentType,
              data.title_pl,
              data.summary_pl,
              data.title_pl,
              data.title_en,
              data.summary_pl,
              data.summary_en,
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
