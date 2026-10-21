/**
 * Add article_summary_pl / article_summary_en (GPT article blurbs).
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
    console.log(`skip ${table}.${column}`);
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
  await addColumn(db, "incidents", "article_summary_pl", "article_summary_pl TEXT");
  await addColumn(db, "incidents", "article_summary_en", "article_summary_en TEXT");
  console.log("migrate-article-summary OK");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
