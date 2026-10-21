import { passesNewsGate } from "@/lib/ai/quality";
import { getDb } from "@/lib/db/client";
import {
  listMapIncidentsForNewsDate,
  listNewsForDate,
  type NewsItemRow,
} from "@/lib/geo/incidents";
import { isLikelyIncident } from "@/lib/sources/relevance";
import { fetchOgImage } from "@/lib/sources/rss";
import type { Confidence } from "@/lib/types";

/** Cap og:image network fetches per news-day request. */
const OG_FETCH_CAP = 8;

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
  /** True when this card is a map pin also shown in News. */
  on_map?: boolean;
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

export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
    ]) {
      u.searchParams.delete(key);
    }
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `${u.protocol}//${u.host}${path}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Loose same-story fingerprint from title (language-agnostic-ish). */
export function storyFingerprint(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 10)
    .join(" ");
}

function sameStory(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 24 && b.length >= 24 && (a.includes(b) || b.includes(a))) {
    return true;
  }
  return false;
}

function toCard(
  row: NewsItemRow,
  opts: { onMap: boolean },
): DayNewsCard | null {
  const title = row.title_en || row.title_pl || row.title || "";
  const summary = row.summary_en || row.summary_pl || row.summary || "";
  const body = row.body;
  const image = row.image_url?.trim() || "";
  // Hard rule: no image → not shown in News
  if (!image) return null;

  if (!opts.onMap) {
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
  }

  const url = row.source_url?.trim() || null;
  if (url?.startsWith("https://strifemap.local/")) return null;

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
    on_map: opts.onMap,
  };
}

async function ensureOgImages(rows: NewsItemRow[]): Promise<NewsItemRow[]> {
  const db = getDb();
  let fetched = 0;
  const out: NewsItemRow[] = [];

  for (const row of rows) {
    if (row.image_url?.trim()) {
      out.push(row);
      continue;
    }
    const pageUrl = row.source_url?.trim();
    if (!pageUrl || pageUrl.startsWith("https://strifemap.local/")) {
      out.push(row);
      continue;
    }
    if (fetched >= OG_FETCH_CAP) {
      out.push(row);
      continue;
    }
    fetched += 1;
    const img = await fetchOgImage(pageUrl);
    if (!img) {
      out.push(row);
      continue;
    }
    try {
      await db.execute({
        sql: `UPDATE incidents SET image_url = ?, updated_at = ? WHERE id = ? AND (image_url IS NULL OR trim(image_url) = '')`,
        args: [img, new Date().toISOString(), row.id],
      });
    } catch {
      /* best-effort persist */
    }
    out.push({ ...row, image_url: img });
  }

  return out;
}

function mergeNewsCards(
  offMap: DayNewsCard[],
  onMap: DayNewsCard[],
): DayNewsCard[] {
  const urls = new Set<string>();
  const stories = new Set<string>();
  const merged: DayNewsCard[] = [];

  const remember = (card: DayNewsCard) => {
    if (card.source_url) urls.add(normalizeSourceUrl(card.source_url));
    const title = card.title_en || card.title_pl || card.title || "";
    const fp = storyFingerprint(title);
    if (fp) stories.add(fp);
    merged.push(card);
  };

  const conflicts = (card: DayNewsCard): boolean => {
    if (card.source_url) {
      const n = normalizeSourceUrl(card.source_url);
      if (urls.has(n)) return true;
    }
    const title = card.title_en || card.title_pl || card.title || "";
    const fp = storyFingerprint(title);
    if (!fp) return false;
    for (const existing of stories) {
      if (sameStory(fp, existing)) return true;
    }
    return false;
  };

  // Prefer existing off-map news, then add map pins that are not duplicates.
  for (const card of offMap) remember(card);
  for (const card of onMap) {
    if (conflicts(card)) continue;
    remember(card);
  }

  merged.sort(
    (a, b) =>
      Date.parse(b.occurred_at) - Date.parse(a.occurred_at) ||
      a.id.localeCompare(b.id),
  );
  return merged;
}

export async function getNewsForDay(options: {
  date: string;
  theaterSlug?: string;
}): Promise<DayNewsCard[]> {
  const [newsRows, mapRowsRaw] = await Promise.all([
    listNewsForDate({ ...options, limit: 60 }),
    listMapIncidentsForNewsDate({ ...options, limit: 40 }),
  ]);

  const mapRows = await ensureOgImages(mapRowsRaw);

  const offMap = newsRows
    .map((r) => toCard(r, { onMap: false }))
    .filter((x): x is DayNewsCard => x != null);
  const onMap = mapRows
    .map((r) => toCard(r, { onMap: true }))
    .filter((x): x is DayNewsCard => x != null);

  return mergeNewsCards(offMap, onMap);
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
             i.map_eligible,
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
        AND i.status IN ('approved', 'published', 'pending')
      LIMIT 1
    `,
    args: [id],
  });
  if (!result.rows.length) return null;
  const row = JSON.parse(JSON.stringify(result.rows[0])) as NewsItemRow & {
    map_eligible?: number;
  };
  const onMap = Number(row.map_eligible) === 1;
  // Map pins skip the off-map news gate; still require image via toCard.
  return toCard(row, { onMap });
}
