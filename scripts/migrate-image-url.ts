/**
 * Add image_url columns to raw_events + incidents (idempotent).
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    if (!process.env[k]) process.env[k] = rest.join("=").trim();
  }
}

async function addColumn(
  db: ReturnType<typeof createClient>,
  table: string,
  column: string,
  ddl: string,
) {
  const cols = await db.execute(`PRAGMA table_info(${table})`);
  const exists = cols.rows.some((r) => String(r.name) === column);
  if (exists) {
    console.log(`skip ${table}.${column} (exists)`);
    return;
  }
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`added ${table}.${column}`);
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

  await addColumn(db, "raw_events", "image_url", "image_url TEXT");
  await addColumn(db, "incidents", "image_url", "image_url TEXT");
  console.log("migrate-image-url OK");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
