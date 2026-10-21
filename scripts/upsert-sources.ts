/**
 * Upsert CATALOG_SOURCES into Turso/local DB; disable fake "War News Seed".
 * Loads .env.local — never prints tokens/keys.
 */
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CATALOG_SOURCES } from "../src/lib/sources/catalog";

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
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const db = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  const theaters = await db.execute(`SELECT id, slug FROM theaters`);
  const slugToId = new Map(
    theaters.rows.map((t) => [String(t.slug), String(t.id)]),
  );

  let inserted = 0;
  let updated = 0;

  for (const s of CATALOG_SOURCES) {
    const theaterId = s.theater ? (slugToId.get(s.theater) ?? null) : null;
    const existing = await db.execute({
      sql: `SELECT id FROM sources WHERE url = ?`,
      args: [s.url],
    });

    if (existing.rows.length) {
      await db.execute({
        sql: `UPDATE sources SET name=?, type=?, theater_id=?, enabled=1, trust_weight=? WHERE id=?`,
        args: [
          s.name,
          s.type,
          theaterId,
          s.trust,
          existing.rows[0].id,
        ],
      });
      updated += 1;
    } else {
      await db.execute({
        sql: `INSERT INTO sources (id, name, url, type, theater_id, enabled, trust_weight)
              VALUES (?, ?, ?, ?, ?, 1, ?)`,
        args: [randomUUID(), s.name, s.url, s.type, theaterId, s.trust],
      });
      inserted += 1;
    }
  }

  // Disable demo seed source (keep rows for historical seed incidents)
  const seedDisable = await db.execute({
    sql: `UPDATE sources SET enabled = 0
          WHERE name = 'War News Seed'
             OR url LIKE 'https://strifemap.local/%'`,
  });

  // Disable known-broken legacy feeds no longer in catalog
  const disableBroken = await db.execute({
    sql: `UPDATE sources SET enabled = 0
          WHERE url LIKE '%rferl.org/api/%'
             OR url = 'https://kyivindependent.com/feed/'`,
  });

  const enabled = await db.execute(
    `SELECT type, COUNT(*) AS c FROM sources WHERE enabled = 1 GROUP BY type`,
  );
  const byType = Object.fromEntries(
    enabled.rows.map((r) => [String(r.type), Number(r.c)]),
  );

  const host = url.startsWith("libsql://")
    ? url.replace(/^libsql:\/\//, "").split("/")[0]
    : "local-file";
  console.log(
    `Upserted sources → ${host}: inserted=${inserted} updated=${updated} seed_disabled=${seedDisable.rowsAffected} broken_disabled=${disableBroken.rowsAffected}`,
  );
  console.log(`Enabled by type:`, byType);
  console.log(`Catalog size: ${CATALOG_SOURCES.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
