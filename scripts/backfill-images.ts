/**
 * Fill missing image_url from article og:image (no OpenAI). Caps work.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fetchOgImage } from "../src/lib/sources/rss";

const LIMIT = Number(process.env.BACKFILL_IMAGE_LIMIT ?? 28);

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    if (!process.env[k]) process.env[k] = rest.join("=").trim();
  }
}

async function main() {
  loadEnvLocal();
  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${path.resolve(process.cwd(), "data", "strifemap.db")}`;
  const db = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  });

  const rows = await db.execute({
    sql: `
      SELECT i.id AS incident_id, r.id AS raw_id, r.url
      FROM incidents i
      JOIN incident_sources isrc ON isrc.incident_id = i.id
      JOIN raw_events r ON r.id = isrc.raw_event_id
      WHERE i.map_eligible = 0
        AND (i.image_url IS NULL OR i.image_url = '')
        AND r.url IS NOT NULL
        AND r.url NOT LIKE 'https://strifemap.local/%'
      ORDER BY i.occurred_at DESC
      LIMIT ?
    `,
    args: [LIMIT],
  });

  let updated = 0;
  let failed = 0;
  for (const row of rows.rows) {
    const pageUrl = String(row.url);
    const img = await fetchOgImage(pageUrl);
    if (!img) {
      failed += 1;
      continue;
    }
    await db.execute({
      sql: `UPDATE incidents SET image_url = ? WHERE id = ?`,
      args: [img, row.incident_id],
    });
    await db.execute({
      sql: `UPDATE raw_events SET image_url = COALESCE(image_url, ?) WHERE id = ?`,
      args: [img, row.raw_id],
    });
    updated += 1;
    console.log(`ok ${updated}/${LIMIT}`);
  }
  console.log(`backfill-images done updated=${updated} missed=${failed}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
