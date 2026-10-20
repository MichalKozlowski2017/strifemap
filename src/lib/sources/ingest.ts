import { getDb } from "@/lib/db/client";
import { fetchRssItems } from "@/lib/sources/rss";
import type { Source } from "@/lib/types";
import { contentHash } from "@/lib/utils/hash";
import { newId, nowIso } from "@/lib/utils/id";

export async function ingestAllSources(): Promise<{
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
}> {
  const db = getDb();
  const sourcesResult = await db.execute(
    `SELECT * FROM sources WHERE enabled = 1 AND type = 'rss'`,
  );
  const sources = sourcesResult.rows as unknown as Source[];

  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const existing = await db.execute(`SELECT content_hash FROM raw_events`);
  const knownHashes = new Set(
    existing.rows.map((r) => String(r.content_hash)),
  );

  const batch: {
    id: string;
    source_id: string;
    url: string;
    title: string;
    body: string;
    content_hash: string;
    fetched_at: string;
  }[] = [];

  for (const source of sources) {
    let items;
    try {
      items = await fetchRssItems(source);
    } catch (err) {
      console.error(`RSS fetch failed for ${source.name}:`, err);
      errors += 1;
      continue;
    }

    for (const item of items) {
      processed += 1;
      const hash = contentHash(item.title, item.url);
      if (knownHashes.has(hash)) {
        skipped += 1;
        continue;
      }
      knownHashes.add(hash);
      batch.push({
        id: newId(),
        source_id: source.id,
        url: item.url,
        title: item.title,
        body: item.body,
        content_hash: hash,
        fetched_at: nowIso(),
      });
    }
  }

  // Batch write in chunks of 40 (one connection)
  const CHUNK = 40;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK);
    const statements = slice.map((row) => ({
      sql: `INSERT OR IGNORE INTO raw_events
        (id, source_id, url, title, body, content_hash, fetched_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        row.id,
        row.source_id,
        row.url,
        row.title,
        row.body,
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

  return { processed, inserted, skipped, errors };
}
