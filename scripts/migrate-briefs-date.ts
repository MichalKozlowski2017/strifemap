import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${path.resolve(process.cwd(), "data", "strifemap.db")}`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  try {
    await db.execute(`ALTER TABLE briefs ADD COLUMN for_date TEXT`);
    console.log("+ briefs.for_date");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("duplicate column") && !msg.includes("already exists")) {
      throw err;
    }
    console.log("= briefs.for_date (exists)");
  }

  // Backfill: use local calendar day of created_at when missing
  await db.execute(`
    UPDATE briefs
    SET for_date = date(created_at, 'localtime')
    WHERE for_date IS NULL OR for_date = ''
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_briefs_day ON briefs(theater_id, kind, for_date)
  `);

  const r = await db.execute(
    `SELECT COUNT(*) AS c, COUNT(for_date) AS with_date FROM briefs`,
  );
  console.log(
    `Briefs date migrate OK → ${url} total=${r.rows[0].c} with_date=${r.rows[0].with_date}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
