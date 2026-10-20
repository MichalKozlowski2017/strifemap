/**
 * Translate missing title_en / title_pl (and summaries) for existing incidents.
 * Cap: BACKFILL_LIMIT (default 40). Does not print secrets.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const LIMIT = Number(process.env.BACKFILL_LIMIT ?? 40);

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
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.error("OPENAI_API_KEY missing");
    process.exit(1);
  }

  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${path.resolve(process.cwd(), "data", "warnews.db")}`;
  const db = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  });

  const openai = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const pending = await db.execute({
    sql: `
      SELECT id, title, summary, title_pl, title_en, summary_pl, summary_en
      FROM incidents
      WHERE (title_en IS NULL OR title_en = '' OR summary_en IS NULL OR summary_en = ''
         OR title_pl IS NULL OR title_pl = '' OR summary_pl IS NULL OR summary_pl = '')
      ORDER BY updated_at DESC
      LIMIT ?
    `,
    args: [LIMIT],
  });

  const remaining = await db.execute(`
    SELECT COUNT(*) AS c FROM incidents
    WHERE (title_en IS NULL OR title_en = '' OR summary_en IS NULL OR summary_en = ''
       OR title_pl IS NULL OR title_pl = '' OR summary_pl IS NULL OR summary_pl = '')
  `);
  const totalMissing = Number(remaining.rows[0].c);

  console.log(
    `Backfill batch size=${pending.rows.length} (cap ${LIMIT}); still missing after this ≈ ${Math.max(0, totalMissing - pending.rows.length)} + failures`,
  );

  let updated = 0;
  let failed = 0;

  for (const row of pending.rows) {
    const titlePl = String(row.title_pl || row.title || "");
    const summaryPl = String(row.summary_pl || row.summary || "");
    const titleEn = String(row.title_en || "");
    const summaryEn = String(row.summary_en || "");

    const needEn = !titleEn || !summaryEn;
    const needPl = !titlePl || !summaryPl;
    if (!needEn && !needPl) continue;

    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Translate conflict-intelligence incident title/summary. Return JSON with title_pl, title_en, summary_pl, summary_en. Keep facts; concise.",
          },
          {
            role: "user",
            content: JSON.stringify({
              title_pl: titlePl || null,
              title_en: titleEn || null,
              summary_pl: summaryPl || null,
              summary_en: summaryEn || null,
              fill: needEn ? "en" : "pl",
            }),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        title_pl?: string;
        title_en?: string;
        summary_pl?: string;
        summary_en?: string;
      };

      const nextTitlePl = (parsed.title_pl || titlePl).slice(0, 200);
      const nextTitleEn = (parsed.title_en || titleEn || titlePl).slice(0, 200);
      const nextSummaryPl = (parsed.summary_pl || summaryPl).slice(0, 800);
      const nextSummaryEn = (
        parsed.summary_en ||
        summaryEn ||
        summaryPl
      ).slice(0, 800);

      await db.execute({
        sql: `
          UPDATE incidents
          SET title_pl = ?, title_en = ?, summary_pl = ?, summary_en = ?,
              title = ?, summary = ?
          WHERE id = ?
        `,
        args: [
          nextTitlePl,
          nextTitleEn,
          nextSummaryPl,
          nextSummaryEn,
          nextTitlePl,
          nextSummaryPl,
          row.id,
        ],
      });
      updated += 1;
      console.log(`ok ${String(row.id).slice(0, 8)}…`);
    } catch (err) {
      failed += 1;
      console.warn(
        `fail ${String(row.id).slice(0, 8)}…`,
        err instanceof Error ? err.message.slice(0, 120) : err,
      );
    }
  }

  const left = await db.execute(`
    SELECT COUNT(*) AS c FROM incidents
    WHERE (title_en IS NULL OR title_en = '' OR summary_en IS NULL OR summary_en = ''
       OR title_pl IS NULL OR title_pl = '' OR summary_pl IS NULL OR summary_pl = '')
  `);

  console.log(
    JSON.stringify({
      updated,
      failed,
      leftovers: Number(left.rows[0].c),
      batchCap: LIMIT,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
