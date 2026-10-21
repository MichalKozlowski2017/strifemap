import { getDb } from "@/lib/db/client";
import {
  EXTRACT_TRIAGE_BATCH,
  remainingExtractApiBudget,
} from "@/lib/ai/budget";
import { getOpenAI, hasOpenAI, modelName } from "@/lib/ai/client";
import {
  autoMapStatus,
  computeMapEligible,
} from "@/lib/ai/quality";
import { incidentExtractSchema } from "@/lib/ai/schemas";
import {
  distanceKm,
  titleSimilarity,
} from "@/lib/sources/normalize";
import {
  inferTheaterSlug,
  triageItem,
} from "@/lib/sources/triage";
import { isoFromLatLng } from "@/lib/geo/countries";
import { guessIsoFromText } from "@/lib/geo/country-names";
import type { Confidence, IncidentType } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils/id";

/** Title Jaccard threshold for merge within 48h. */
const MERGE_TITLE_THRESHOLD = 0.55;
/** Max distance (km) between coords to treat as same incident. */
const MERGE_DISTANCE_KM = 50;
/** Cap body chars sent to the model (token savings). */
const EXTRACT_BODY_CHARS = 1_800;
/** Drop absurd model dates (archive reprints / hallucinations). */
const OCCURRED_MAX_PAST_MS = 14 * 24 * 60 * 60 * 1000;
const OCCURRED_MAX_FUTURE_MS = 6 * 60 * 60 * 1000;

function resolveOccurredAt(
  raw: string | null | undefined,
  fallbackIso: string,
): string {
  if (!raw || Number.isNaN(Date.parse(raw))) return fallbackIso;
  const t = new Date(raw).getTime();
  const now = Date.now();
  if (t > now + OCCURRED_MAX_FUTURE_MS || t < now - OCCURRED_MAX_PAST_MS) {
    return fallbackIso;
  }
  return new Date(t).toISOString();
}

const SYSTEM = `You extract structured conflict/security incidents from news items.
Return one JSON object. Do not invent facts.
If not conflict/security/military/hybrid, return {"is_incident":false}.

When is_incident is true, EXACT fields:
{"is_incident":true,"theater_slug":"ukraine-russia"|"middle-east"|"africa"|"indo-pacific"|"europe-hybrid"|"americas","type":"kinetic"|"sabotage"|"cyber"|"air"|"naval"|"diplomatic"|"other","title_pl":string,"title_en":string,"summary_pl":string,"summary_en":string,"lat":number|null,"lng":number|null,"occurred_at":ISO-8601|null,"confidence":"confirmed"|"reported"|"unverified","merge_hint":string|null}
Rules: bilingual PL+EN; confidence one of three strings; prefer real coords else null; merge_hint = place+event key or null. Keep summaries to ~2 sentences.`;

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
    o.type =
      typeMap[t] ?? (t.includes("drone") || t.includes("missile") ? "air" : t);
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
    else if (["medium", "likely", "reported"].includes(c))
      o.confidence = "reported";
    else if (["low", "unclear", "unverified"].includes(c))
      o.confidence = "unverified";
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
    baltic: "europe-hybrid",
    china: "indo-pacific",
    "south-china-sea": "indo-pacific",
    taiwan: "indo-pacific",
  };
  if (typeof o.theater_slug === "string") {
    const s = o.theater_slug.toLowerCase().trim();
    o.theater_slug = theaterMap[s] ?? s;
  }

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
  image_url: string | null;
  theater_id: string | null;
  theater_slug: string | null;
  trust_weight: number;
};

/** Several sentences from stored body — no OpenAI. */
function snippetSummary(title: string, body: string | null): string {
  const raw = (body ?? title).replace(/\s+/g, " ").trim();
  const parts = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [raw];
  return parts.slice(0, 6).join(" ").trim().slice(0, 1_200);
}

export async function extractIncidents(limit?: number): Promise<{
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  newsCreated: number;
  droppedHeuristic: number;
  apiCalls: number;
  apiBudgetRemaining: number;
  skippedNoKey: boolean;
  skippedDailyCap: boolean;
}> {
  if (!hasOpenAI()) {
    return {
      processed: 0,
      created: 0,
      merged: 0,
      skipped: 0,
      newsCreated: 0,
      droppedHeuristic: 0,
      apiCalls: 0,
      apiBudgetRemaining: 0,
      skippedNoKey: true,
      skippedDailyCap: false,
    };
  }

  const budget = await remainingExtractApiBudget();
  const apiCap = limit != null ? Math.min(limit, budget.runCap) : budget.runCap;
  // Even at daily API ceiling we still drain drop/news heuristically (0 tokens).
  const openai = apiCap > 0 ? getOpenAI()! : null;
  const db = getDb();

  // Only never-classified rows (pending). Already processed/skipped/error stay put.
  const pending = await db.execute({
    sql: `
      SELECT r.id, r.title, r.body, r.url, r.image_url, s.theater_id, s.trust_weight,
             t.slug AS theater_slug
      FROM raw_events r
      JOIN sources s ON s.id = r.source_id
      LEFT JOIN theaters t ON t.id = s.theater_id
      WHERE r.status = 'pending' AND r.body IS NOT NULL
      ORDER BY s.trust_weight DESC, r.fetched_at ASC
      LIMIT ?
    `,
    args: [EXTRACT_TRIAGE_BATCH],
  });

  const rows = pending.rows as unknown as PendingRow[];
  let created = 0;
  let merged = 0;
  let skipped = 0;
  let newsCreated = 0;
  let droppedHeuristic = 0;
  let apiCalls = 0;
  let triaged = 0;

  const theaters = await db.execute(`SELECT id, slug FROM theaters`);
  const slugToId = new Map(
    theaters.rows.map((t) => [String(t.slug), String(t.id)]),
  );

  for (const row of rows) {
    triaged += 1;
    const trust = Number(row.trust_weight) || 1;
    const { decision } = triageItem({
      title: row.title,
      body: row.body,
      trustWeight: trust,
      theaterSlug: row.theater_slug,
    });

    if (decision === "drop") {
      await markRaw(row.id, "skipped");
      droppedHeuristic += 1;
      skipped += 1;
      continue;
    }

    if (decision === "news") {
      const ok = await createNewsOnlyIncident(row, slugToId, trust);
      if (ok) newsCreated += 1;
      else skipped += 1;
      continue;
    }

    // decision === "extract" — OpenAI only if budget left
    if (!openai || apiCalls >= apiCap) {
      // Leave map-candidates pending for a later run (do not re-mark)
      continue;
    }
    const client = openai;

    try {
      apiCalls += 1;
      const completion = await client.chat.completions.create({
        model: modelName(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              title: row.title,
              body: row.body?.slice(0, EXTRACT_BODY_CHARS) ?? "",
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
      // Don't overwrite existing bilingual fields on merge path; new rows get both.
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
        const lat = matchLat ?? data.lat;
        const lng = matchLng ?? data.lng;
        const eligible = computeMapEligible({
          confidence,
          lat,
          lng,
          sourceCount: count,
          trustWeight: trust,
        })
          ? 1
          : 0;
        const mergeLat = matchLat ?? data.lat;
        const mergeLng = matchLng ?? data.lng;
        const mergeIso =
          mergeLat != null && mergeLng != null
            ? isoFromLatLng(Number(mergeLat), Number(mergeLng))
            : null;
        await db.execute({
          sql: `UPDATE incidents SET lat = COALESCE(lat, ?), lng = COALESCE(lng, ?),
            map_eligible = ?,
            country_iso = COALESCE(country_iso, ?),
            updated_at = ? WHERE id = ?`,
          args: [
            data.lat,
            data.lng,
            eligible,
            mergeIso,
            nowIso(),
            matchId,
          ],
        });
        await markRaw(row.id, "processed");
        merged += 1;
        continue;
      }

      const incidentId = newId();
      const occurred = resolveOccurredAt(data.occurred_at, nowIso());
      const sourceCount = 1;
      const mapEligible = computeMapEligible({
        confidence: data.confidence,
        lat: data.lat,
        lng: data.lng,
        sourceCount,
        trustWeight: trust,
      });
      const status = autoMapStatus({
        mapEligible,
        confidence: data.confidence,
        sourceCount,
        trustWeight: trust,
      });
      const countryIso =
        data.lat != null && data.lng != null
          ? isoFromLatLng(Number(data.lat), Number(data.lng))
          : guessIsoFromText(data.title_en, data.title_pl, data.summary_en, data.summary_pl);

      await db.batch(
        [
          {
            sql: `INSERT INTO incidents (
              id, theater_id, type, title, summary,
              title_pl, title_en, summary_pl, summary_en,
              lat, lng, occurred_at,
              confidence, status, map_eligible, image_url, country_iso, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              mapEligible ? 1 : 0,
              row.image_url,
              countryIso,
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
    processed: triaged,
    created,
    merged,
    skipped,
    newsCreated,
    droppedHeuristic,
    apiCalls,
    apiBudgetRemaining: Math.max(0, budget.remainingToday - apiCalls),
    skippedNoKey: false,
    skippedDailyCap: apiCap <= 0,
  };
}

/** Conflict news without OpenAI — no coords, never map_eligible. */
async function createNewsOnlyIncident(
  row: PendingRow,
  slugToId: Map<string, string>,
  trust: number,
): Promise<boolean> {
  const db = getDb();
  const theaterSlug = inferTheaterSlug(
    row.title,
    row.body,
    row.theater_slug,
  );
  const theaterId =
    row.theater_id || slugToId.get(theaterSlug) || slugToId.get("europe-hybrid");
  if (!theaterId) return false;

  const summary = snippetSummary(row.title, row.body);
  // Reuse source language for both locales — do not spend tokens translating.
  const title = row.title.trim();
  const incidentId = newId();
  const countryIso = guessIsoFromText(title, summary, row.body);

  await db.batch(
    [
      {
        sql: `INSERT INTO incidents (
          id, theater_id, type, title, summary,
          title_pl, title_en, summary_pl, summary_en,
          lat, lng, occurred_at,
          confidence, status, map_eligible, image_url, country_iso, created_at, updated_at
        ) VALUES (?, ?, 'other', ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'reported', 'pending', 0, ?, ?, ?, ?)`,
        args: [
          incidentId,
          theaterId,
          title,
          summary,
          title,
          title,
          summary,
          summary,
          nowIso(),
          row.image_url,
          countryIso,
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
  void trust; // used by triage already; kept for future trust column
  return true;
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
