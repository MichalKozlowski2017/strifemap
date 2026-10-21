/**
 * 1) Backfill missing image_url from og/twitter image (cap).
 * 2) GPT-4o bilingual article summaries for items with images (cap ~30).
 * Never prints secrets.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { fetchOgImage } from "../src/lib/sources/rss";

const IMAGE_LIMIT = Number(process.env.BACKFILL_IMAGE_LIMIT ?? 40);
const SUMMARY_LIMIT = Number(process.env.BACKFILL_SUMMARY_LIMIT ?? 30);
const SUMMARY_MODEL = process.env.NEWS_SUMMARY_MODEL?.trim() || "gpt-4o";

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

  // —— Images ——
  const missingImg = await db.execute({
    sql: `
      SELECT i.id AS incident_id, r.id AS raw_id, r.url
      FROM incidents i
      JOIN incident_sources isrc ON isrc.incident_id = i.id
      JOIN raw_events r ON r.id = isrc.raw_event_id
      WHERE i.map_eligible = 0
        AND (i.image_url IS NULL OR trim(i.image_url) = '')
        AND r.url IS NOT NULL
        AND r.url NOT LIKE 'https://strifemap.local/%'
      GROUP BY i.id
      ORDER BY i.occurred_at DESC
      LIMIT ?
    `,
    args: [IMAGE_LIMIT],
  });

  let imgOk = 0;
  let imgMiss = 0;
  for (const row of missingImg.rows) {
    const img = await fetchOgImage(String(row.url));
    if (!img) {
      imgMiss += 1;
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
    imgOk += 1;
  }
  console.log(`images: updated=${imgOk} missed=${imgMiss}`);

  // —— GPT article summaries (only with image, missing article_summary_*) ——
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.log("summaries: skipped (no OPENAI_API_KEY)");
    return;
  }

  const needSum = await db.execute({
    sql: `
      SELECT i.id, i.title, i.title_pl, i.title_en, i.summary, i.summary_pl, i.summary_en,
             i.article_summary_pl, i.article_summary_en,
             (
               SELECT r.body FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               WHERE isrc.incident_id = i.id
               ORDER BY length(COALESCE(r.body,'')) DESC LIMIT 1
             ) AS body,
             (
               SELECT r.url FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
               ORDER BY s.trust_weight DESC LIMIT 1
             ) AS source_url
      FROM incidents i
      WHERE i.map_eligible = 0
        AND i.image_url IS NOT NULL AND trim(i.image_url) != ''
        AND (i.article_summary_pl IS NULL OR trim(i.article_summary_pl) = ''
             OR i.article_summary_en IS NULL OR trim(i.article_summary_en) = '')
      ORDER BY i.occurred_at DESC
      LIMIT ?
    `,
    args: [SUMMARY_LIMIT],
  });

  const openai = new OpenAI({ apiKey: key });
  let sumOk = 0;
  let sumFail = 0;

  for (const row of needSum.rows) {
    const title = String(row.title_en || row.title_pl || row.title || "");
    const body = String(row.body || row.summary_en || row.summary_pl || row.summary || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2_500);
    if (!title) {
      sumFail += 1;
      continue;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: SUMMARY_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Summarize a conflict/security news item in 2–3 sentences each language. Return JSON: {"summary_pl":"...","summary_en":"..."}. Do not invent facts. Stay neutral.',
          },
          {
            role: "user",
            content: JSON.stringify({
              title,
              body,
              url: row.source_url ? String(row.source_url) : null,
            }),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        summary_pl?: string;
        summary_en?: string;
      };
      const pl = parsed.summary_pl?.trim();
      const en = parsed.summary_en?.trim();
      if (!pl || !en) {
        sumFail += 1;
        continue;
      }
      await db.execute({
        sql: `UPDATE incidents SET article_summary_pl = ?, article_summary_en = ?, updated_at = ? WHERE id = ?`,
        args: [pl, en, new Date().toISOString(), row.id],
      });
      sumOk += 1;
      console.log(`summary ${sumOk}/${SUMMARY_LIMIT}`);
    } catch {
      sumFail += 1;
    }
  }

  console.log(
    `summaries: model=${SUMMARY_MODEL} ok=${sumOk} fail=${sumFail} (key present, not printed)`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
