import type { Source } from "@/lib/types";
import type { NormalizedRssItem } from "@/lib/sources/rss";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

type GdeltResponse = {
  articles?: GdeltArticle[];
};

const MAX_BODY = 1_200;

/**
 * GDELT DOC 2.0 ArtList — free JSON, no API key.
 * `source.url` should be a full GDELT doc API URL (format=json).
 */
export async function fetchGdeltItems(
  source: Source,
): Promise<NormalizedRssItem[]> {
  const res = await fetch(source.url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WarNews/1.0 (+https://github.com/MichalKozlowski2017/warnews)",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`GDELT HTTP ${res.status}`);
  }
  const json = (await res.json()) as GdeltResponse;
  const articles = json.articles ?? [];
  return articles
    .filter((a) => a.url && a.title)
    .slice(0, 40)
    .map((a) => {
      const publishedAt = parseGdeltDate(a.seendate);
      const meta = [
        a.domain ? `Source: ${a.domain}` : null,
        a.sourcecountry ? `Country: ${a.sourcecountry}` : null,
        a.language ? `Lang: ${a.language}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const body = [a.title, meta].filter(Boolean).join("\n").slice(0, MAX_BODY);
      return {
        title: String(a.title).trim(),
        url: String(a.url).trim(),
        body,
        publishedAt,
      };
    });
}

/** GDELT seendate looks like 20261020T183045Z */
function parseGdeltDate(raw: string | undefined): Date | null {
  if (!raw || raw.length < 15) return null;
  const m = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
  );
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
