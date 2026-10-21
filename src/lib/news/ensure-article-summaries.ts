/**
 * Fill missing article_summary_pl/en for incidents that already have an image.
 * Never overwrites stored summaries. Caps GPT calls.
 */
import OpenAI from "openai";
import { getDb } from "@/lib/db/client";

const DEFAULT_CAP = 15;
const MODEL =
  process.env.NEWS_SUMMARY_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-4o-mini";

export async function ensureMissingArticleSummaries(options?: {
  limit?: number;
  /** Prefer map pins (accordion) when true. */
  mapEligibleOnly?: boolean;
}): Promise<{ ok: number; fail: number; skipped: number }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { ok: 0, fail: 0, skipped: 0 };

  const limit = Math.min(options?.limit ?? DEFAULT_CAP, 15);
  const db = getDb();
  const mapClause =
    options?.mapEligibleOnly === false
      ? ""
      : "AND i.map_eligible = 1";

  const need = await db.execute({
    sql: `
      SELECT i.id, i.title, i.title_pl, i.title_en, i.summary, i.summary_pl, i.summary_en,
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
      WHERE (i.image_url IS NOT NULL AND trim(i.image_url) != '')
        AND (i.article_summary_pl IS NULL OR trim(i.article_summary_pl) = '')
        AND (i.article_summary_en IS NULL OR trim(i.article_summary_en) = '')
        AND i.status IN ('approved', 'published', 'pending')
        ${mapClause}
      ORDER BY i.occurred_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  if (!need.rows.length) return { ok: 0, fail: 0, skipped: 0 };

  const openai = new OpenAI({ apiKey: key });
  let ok = 0;
  let fail = 0;

  for (const row of need.rows) {
    const title = String(row.title_en || row.title_pl || row.title || "");
    const body = String(
      row.body || row.summary_en || row.summary_pl || row.summary || "",
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2_500);
    if (!title) {
      fail += 1;
      continue;
    }
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
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
        fail += 1;
        continue;
      }
      // Only fill empty — never overwrite.
      await db.execute({
        sql: `
          UPDATE incidents
          SET article_summary_pl = COALESCE(NULLIF(trim(article_summary_pl), ''), ?),
              article_summary_en = COALESCE(NULLIF(trim(article_summary_en), ''), ?),
              updated_at = ?
          WHERE id = ?
            AND (article_summary_pl IS NULL OR trim(article_summary_pl) = '')
            AND (article_summary_en IS NULL OR trim(article_summary_en) = '')
        `,
        args: [pl, en, new Date().toISOString(), row.id],
      });
      ok += 1;
    } catch {
      fail += 1;
    }
  }

  return { ok, fail, skipped: 0 };
}
