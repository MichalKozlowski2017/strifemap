import { passesNewsGate } from "@/lib/ai/quality";
import { getDb } from "@/lib/db/client";
import { listNewsForDate, type NewsItemRow } from "@/lib/geo/incidents";
import { isLikelyIncident } from "@/lib/sources/relevance";
import type { Confidence } from "@/lib/types";

export type DayNewsCard = {
  id: string;
  occurred_at: string;
  title: string | null;
  summary: string | null;
  title_pl: string | null;
  title_en: string | null;
  summary_pl: string | null;
  summary_en: string | null;
  article_summary_pl: string | null;
  article_summary_en: string | null;
  /** Longer stored body for news page (several sentences). */
  body: string | null;
  /** Always non-null for public cards — items without images are filtered out. */
  image_url: string;
  source_name: string;
  source_url: string | null;
  country_iso: string | null;
};

/** Prefer GPT article summary, else several sentences from summary/body. */
export function newsCopy(
  summary: string,
  body: string | null,
  maxSentences = 5,
  maxChars = 900,
): string {
  const prefer =
    summary.trim().length >= 160 ? summary : body?.trim() || summary;
  const cleaned = prefer.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const joined = parts.slice(0, maxSentences).join(" ").trim();
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars - 1).trimEnd()}…`;
}

export function articleSummaryForLocale(
  item: Pick<
    DayNewsCard,
    | "article_summary_pl"
    | "article_summary_en"
    | "summary_pl"
    | "summary_en"
    | "summary"
    | "body"
  >,
  locale: "pl" | "en",
): string {
  if (locale === "pl") {
    return (
      item.article_summary_pl?.trim() ||
      item.summary_pl?.trim() ||
      newsCopy(item.summary || "", item.body, 4, 700)
    );
  }
  return (
    item.article_summary_en?.trim() ||
    item.summary_en?.trim() ||
    newsCopy(item.summary || "", item.body, 4, 700)
  );
}

function toCard(row: NewsItemRow): DayNewsCard | null {
  const title = row.title_en || row.title_pl || row.title || "";
  const summary = row.summary_en || row.summary_pl || row.summary || "";
  const body = row.body;
  const image = row.image_url?.trim() || "";
  // Hard rule: no image → not shown
  if (!image) return null;

  const relevanceOk = isLikelyIncident(title, summary || body);
  const confidence = (row.confidence || "reported") as Confidence;

  if (
    !passesNewsGate({
      mapEligible: false,
      confidence,
      sourceCount: Number(row.source_count) || 1,
      trustWeight: Number(row.trust_weight) || 1,
      relevanceOk,
    })
  ) {
    return null;
  }

  const url = row.source_url?.trim() || null;
  if (url?.startsWith("https://warnews.local/")) return null;

  return {
    id: String(row.id),
    occurred_at: String(row.occurred_at),
    title: row.title,
    summary: row.summary,
    title_pl: row.title_pl,
    title_en: row.title_en,
    summary_pl: row.summary_pl,
    summary_en: row.summary_en,
    article_summary_pl:
      row.article_summary_pl != null ? String(row.article_summary_pl) : null,
    article_summary_en:
      row.article_summary_en != null ? String(row.article_summary_en) : null,
    body: body != null ? String(body) : null,
    image_url: image,
    source_name: row.source_name?.trim() || "—",
    source_url: url,
    country_iso:
      row.country_iso != null && String(row.country_iso).trim()
        ? String(row.country_iso).trim().toUpperCase()
        : null,
  };
}

export async function getNewsForDay(options: {
  date: string;
  theaterSlug?: string;
}): Promise<DayNewsCard[]> {
  const rows = await listNewsForDate({ ...options, limit: 60 });
  return rows.map(toCard).filter((x): x is DayNewsCard => x != null);
}

export async function getNewsArticleById(
  id: string,
): Promise<DayNewsCard | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT i.id, i.occurred_at, i.title, i.summary,
             i.title_pl, i.title_en, i.summary_pl, i.summary_en, i.type,
             i.confidence, i.country_iso, i.article_summary_pl, i.article_summary_en,
             t.slug AS theater_slug,
             COALESCE(i.image_url, (
               SELECT r.image_url FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               WHERE isrc.incident_id = i.id AND r.image_url IS NOT NULL
               LIMIT 1
             )) AS image_url,
             (
               SELECT r.body FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               WHERE isrc.incident_id = i.id
               ORDER BY length(COALESCE(r.body,'')) DESC LIMIT 1
             ) AS body,
             (
               SELECT s.name FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
               ORDER BY s.trust_weight DESC LIMIT 1
             ) AS source_name,
             (
               SELECT r.url FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
               ORDER BY s.trust_weight DESC LIMIT 1
             ) AS source_url,
             (
               SELECT COALESCE(MAX(s.trust_weight), 1.0) FROM incident_sources isrc
               JOIN raw_events r ON r.id = isrc.raw_event_id
               JOIN sources s ON s.id = r.source_id
               WHERE isrc.incident_id = i.id
             ) AS trust_weight,
             (
               SELECT COUNT(*) FROM incident_sources isrc
               WHERE isrc.incident_id = i.id
             ) AS source_count
      FROM incidents i
      JOIN theaters t ON t.id = i.theater_id
      WHERE i.id = ?
        AND i.map_eligible = 0
        AND i.status IN ('approved', 'published', 'pending')
      LIMIT 1
    `,
    args: [id],
  });
  if (!result.rows.length) return null;
  const row = JSON.parse(JSON.stringify(result.rows[0])) as NewsItemRow;
  return toCard(row);
}
