import type { DayIncidentCard } from "@/components/day/day-reader";
import type { DayNewsCard } from "@/lib/news/items";

/** Map DB rows (+ optional news enrich) into accordion cards. */
export function toDayIncidentCards(
  rows: Record<string, unknown>[],
  news: DayNewsCard[] = [],
): DayIncidentCard[] {
  const newsById = new Map(news.map((n) => [n.id, n]));

  return rows.map((r) => {
    const id = String(r.id);
    const fromNews = newsById.get(id);
    const resolvedImg =
      (r.resolved_image_url != null && String(r.resolved_image_url).trim()) ||
      (r.image_url != null && String(r.image_url).trim()) ||
      fromNews?.image_url ||
      "";
    const artPl =
      (r.article_summary_pl != null && String(r.article_summary_pl).trim()) ||
      fromNews?.article_summary_pl ||
      null;
    const artEn =
      (r.article_summary_en != null && String(r.article_summary_en).trim()) ||
      fromNews?.article_summary_en ||
      null;

    return {
      id,
      type: r.type as DayIncidentCard["type"],
      confidence: r.confidence as DayIncidentCard["confidence"],
      occurred_at: String(r.occurred_at),
      title: r.title != null ? String(r.title) : null,
      summary: r.summary != null ? String(r.summary) : null,
      title_pl: r.title_pl != null ? String(r.title_pl) : null,
      title_en: r.title_en != null ? String(r.title_en) : null,
      summary_pl: r.summary_pl != null ? String(r.summary_pl) : null,
      summary_en: r.summary_en != null ? String(r.summary_en) : null,
      article_summary_pl: artPl,
      article_summary_en: artEn,
      image_url: resolvedImg || null,
      source_name:
        (r.source_name != null && String(r.source_name).trim()) ||
        fromNews?.source_name ||
        null,
      source_url:
        (r.source_url != null && String(r.source_url).trim()) ||
        fromNews?.source_url ||
        null,
      theater_name_pl: r.name_pl != null ? String(r.name_pl) : undefined,
      theater_name_en: r.name_en != null ? String(r.name_en) : undefined,
      country_iso:
        r.country_iso != null && String(r.country_iso).trim()
          ? String(r.country_iso).trim().toUpperCase()
          : null,
    };
  });
}
