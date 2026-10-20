import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

async function addColumn(
  db: ReturnType<typeof createClient>,
  table: string,
  column: string,
  typeSql: string,
) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
    console.log(`+ ${table}.${column}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      console.log(`= ${table}.${column} (exists)`);
      return;
    }
    throw err;
  }
}

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${path.resolve(process.cwd(), "data", "warnews.db")}`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  await addColumn(db, "incidents", "title_pl", "TEXT");
  await addColumn(db, "incidents", "title_en", "TEXT");
  await addColumn(db, "incidents", "summary_pl", "TEXT");
  await addColumn(db, "incidents", "summary_en", "TEXT");

  // Backfill columns from legacy title/summary where empty
  await db.execute(`
    UPDATE incidents SET title_pl = title
    WHERE title_pl IS NULL OR title_pl = ''
  `);
  await db.execute(`
    UPDATE incidents SET summary_pl = summary
    WHERE summary_pl IS NULL OR summary_pl = ''
  `);

  console.log(`Bilingual migrate OK → ${url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
