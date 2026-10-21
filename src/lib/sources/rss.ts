import Parser from "rss-parser";
import type { Source } from "@/lib/types";

const MAX_BODY = 8_000;

type RssItem = Parser.Item & {
  contentEncoded?: string;
  "content:encoded"?: string;
  enclosure?: { url?: string; type?: string };
  "media:content"?: { $?: { url?: string; medium?: string; type?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
  mediaContent?: { $?: { url?: string; medium?: string; type?: string } };
  mediaThumbnail?: { $?: { url?: string } };
};

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent": "StrifeMap/1.0 (+https://github.com/MichalKozlowski2017/strifemap)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildBody(item: RssItem): string {
  const encoded = item.contentEncoded ?? item["content:encoded"];
  const fromEncoded = encoded ? stripHtml(encoded) : "";
  const snippet = stripHtml(item.contentSnippet ?? item.content ?? "");
  const raw = fromEncoded.length > snippet.length ? fromEncoded : snippet;
  return truncate(raw, MAX_BODY);
}

function firstImgFromHtml(html: string | undefined): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.startsWith("http") ? m[1] : null;
}

function looksLikeImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)) return true;
  // Many CDNs omit extension — still accept http(s) from enclosure/media
  return true;
}

/** Prefer enclosure / media / inline img — no network. */
export function extractRssImageUrl(item: RssItem): string | null {
  const enc = item.enclosure;
  if (enc?.url && (!enc.type || enc.type.startsWith("image/")) && looksLikeImageUrl(enc.url)) {
    return enc.url.trim();
  }
  const media =
    item.mediaContent?.$?.url ||
    item["media:content"]?.$?.url ||
    item.mediaThumbnail?.$?.url ||
    item["media:thumbnail"]?.$?.url;
  if (media && looksLikeImageUrl(media)) return media.trim();

  const fromEncoded = firstImgFromHtml(
    item.contentEncoded ?? item["content:encoded"],
  );
  if (fromEncoded) return fromEncoded;

  const fromContent = firstImgFromHtml(item.content);
  if (fromContent) return fromContent;

  return null;
}

/** Lightweight og:image fetch when RSS has no media. Timeout short; never throws. */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "StrifeMap/1.0 (+https://github.com/MichalKozlowski2017/strifemap)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(4_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 80_000);
    const patterns = [
      /property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["']\s+property=["']og:image["']/i,
      /name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1] && looksLikeImageUrl(m[1])) return m[1].trim();
    }
    return null;
  } catch {
    return null;
  }
}

export type NormalizedRssItem = {
  title: string;
  url: string;
  body: string;
  imageUrl: string | null;
  publishedAt: Date | null;
};

export async function fetchRssItems(
  source: Source,
): Promise<NormalizedRssItem[]> {
  const feed = await parser.parseURL(source.url);
  const items = (feed.items ?? []).slice(0, 25);
  const out: NormalizedRssItem[] = [];
  let ogAttempts = 0;

  for (const raw of items) {
    const item = raw as RssItem;
    const url = item.link?.trim() || source.url;
    let imageUrl = extractRssImageUrl(item);
    // Cap og:image attempts per feed to keep ingest fast
    if (!imageUrl && ogAttempts < 4) {
      ogAttempts += 1;
      imageUrl = await fetchOgImage(url);
    }
    out.push({
      title: item.title?.trim() || "Untitled",
      url,
      body: buildBody(item),
      imageUrl,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    });
  }
  return out;
}
