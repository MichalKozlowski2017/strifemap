import { listNewsForDate, type NewsItemRow } from "@/lib/geo/incidents";
import { isLikelyIncident } from "@/lib/sources/relevance";

export type DayNewsCard = {
  id: string;
  occurred_at: string;
  title: string | null;
  summary: string | null;
  title_pl: string | null;
  title_en: string | null;
  summary_pl: string | null;
  summary_en: string | null;
  source_name: string;
  source_url: string | null;
};

/** Trim body to roughly two sentences for the news list. */
export function twoSentences(text: string, maxChars = 320): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const joined = parts.slice(0, 2).join(" ").trim();
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars - 1).trimEnd()}…`;
}

function toCard(row: NewsItemRow): DayNewsCard | null {
  const title = row.title_en || row.title_pl || row.title || "";
  const summary = row.summary_en || row.summary_pl || row.summary || "";
  if (!isLikelyIncident(title, summary)) return null;

  const url = row.source_url?.trim() || null;
  // Skip demo seed URLs
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
    source_name: row.source_name?.trim() || "—",
    source_url: url,
  };
}

export async function getNewsForDay(options: {
  date: string;
  theaterSlug?: string;
}): Promise<DayNewsCard[]> {
  const rows = await listNewsForDate(options);
  return rows.map(toCard).filter((x): x is DayNewsCard => x != null);
}
