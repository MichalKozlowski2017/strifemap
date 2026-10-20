import { passesNewsGate } from "@/lib/ai/quality";
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
  /** Longer stored body for news page (several sentences). */
  body: string | null;
  image_url: string | null;
  source_name: string;
  source_url: string | null;
};

/** Prefer several sentences from summary or body — no OpenAI. */
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

/** Short teaser blurb. */
export function newsTeaserCopy(summary: string, body: string | null): string {
  return newsCopy(summary, body, 2, 220);
}

function toCard(row: NewsItemRow): DayNewsCard | null {
  const title = row.title_en || row.title_pl || row.title || "";
  const summary = row.summary_en || row.summary_pl || row.summary || "";
  const body = row.body;
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
    body: body != null ? String(body) : null,
    image_url: row.image_url != null ? String(row.image_url) : null,
    source_name: row.source_name?.trim() || "—",
    source_url: url,
  };
}

export async function getNewsForDay(options: {
  date: string;
  theaterSlug?: string;
}): Promise<DayNewsCard[]> {
  const rows = await listNewsForDate({ ...options, limit: 50 });
  return rows.map(toCard).filter((x): x is DayNewsCard => x != null);
}
