import { getDb } from "@/lib/db/client";
import { fetchGdeltItems } from "@/lib/sources/gdelt";
import {
  canonicalizeUrl,
  titleFingerprint,
  titleSimilarity,
} from "@/lib/sources/normalize";
import { isLikelyIncident } from "@/lib/sources/relevance";
import { fetchRssItems, type NormalizedRssItem } from "@/lib/sources/rss";
import type { Source } from "@/lib/types";
import { contentHash } from "@/lib/utils/hash";
import { newId, nowIso } from "@/lib/utils/id";

/** Jaccard threshold for near-duplicate title skip during ingest. */
const NEAR_DUP_THRESHOLD = 0.72;

export async function ingestAllSources(): Promise<{
  processed: number;
  inserted: number;
  skipped: number;
  skippedNoise: number;
  skippedNearDup: number;
  errors: number;
}> {
  const db = getDb();
  const sourcesResult = await db.execute(
    `SELECT * FROM sources WHERE enabled = 1 AND type IN ('rss', 'gdelt')`,
  );
  const sources = sourcesResult.rows as unknown as Source[];

  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  let skippedNoise = 0;
  let skippedNearDup = 0;
  let errors = 0;

  const existing = await db.execute(`SELECT content_hash FROM raw_events`);
  const knownHashes = new Set(
    existing.rows.map((r) => String(r.content_hash)),
  );

  // Recent titles for near-dup (last 7 days + this run)
  const recentTitles = await db.execute({
    sql: `SELECT title FROM raw_events WHERE fetched_at >= ? ORDER BY fetched_at DESC LIMIT 800`,
    args: [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()],
  });
  const knownTitles: string[] = recentTitles.rows.map((r) => String(r.title));

  const batch: {
    id: string;
    source_id: string;
    url: string;
    title: string;
    body: string;
    image_url: string | null;
    content_hash: string;
    fetched_at: string;
  }[] = [];

  for (const source of sources) {
    let items: NormalizedRssItem[];
    try {
      items =
        source.type === "gdelt"
          ? await fetchGdeltItems(source)
          : await fetchRssItems(source);
    } catch (err) {
      console.error(`Fetch failed for ${source.name} (${source.type}):`, err);
      errors += 1;
      continue;
    }

    for (const item of items) {
      processed += 1;

      if (!isLikelyIncident(item.title, item.body)) {
        skippedNoise += 1;
        continue;
      }

      const canonUrl = canonicalizeUrl(item.url);
      const titleFp = titleFingerprint(item.title);
      const hash = contentHash(titleFp || item.title, canonUrl);

      if (knownHashes.has(hash)) {
        skipped += 1;
        continue;
      }

      const nearDup = knownTitles.some(
        (t) => titleSimilarity(item.title, t) >= NEAR_DUP_THRESHOLD,
      );
      if (nearDup) {
        skippedNearDup += 1;
        continue;
      }

      knownHashes.add(hash);
      knownTitles.push(item.title);
      batch.push({
        id: newId(),
        source_id: source.id,
        url: canonUrl,
        title: item.title,
        body: item.body,
        image_url: item.imageUrl ?? null,
        content_hash: hash,
        fetched_at: nowIso(),
      });
    }
  }

  const CHUNK = 40;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK);
    const statements = slice.map((row) => ({
      sql: `INSERT OR IGNORE INTO raw_events
        (id, source_id, url, title, body, image_url, content_hash, fetched_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        row.id,
        row.source_id,
        row.url,
        row.title,
        row.body,
        row.image_url,
        row.content_hash,
        row.fetched_at,
      ],
    }));
    const results = await db.batch(statements, "write");
    for (const r of results) {
      if (r.rowsAffected > 0) inserted += 1;
      else skipped += 1;
    }
  }

  return {
    processed,
    inserted,
    skipped,
    skippedNoise,
    skippedNearDup,
    errors,
  };
}
