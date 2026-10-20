import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      if (idx === -1) return line;
      // keep -- inside strings roughly: only strip full-line / trailing comments
      const before = line.slice(0, idx);
      if ((before.match(/'/g) ?? []).length % 2 === 1) return line;
      return before;
    })
    .join("\n");
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

  const schemaPath = path.resolve(process.cwd(), "src/lib/db/schema.sql");
  const raw = fs.readFileSync(schemaPath, "utf8");
  const sql = stripSqlComments(raw);

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  console.log(`Migrated OK → ${url} (${statements.length} statements)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
