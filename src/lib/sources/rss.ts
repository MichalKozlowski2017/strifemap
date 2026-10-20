import Parser from "rss-parser";
import type { Source } from "@/lib/types";

const MAX_BODY = 4_000;

type RssItem = Parser.Item & {
  contentEncoded?: string;
  "content:encoded"?: string;
};

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent": "WarNews/1.0 (+https://github.com/MichalKozlowski2017/warnews)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
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

export type NormalizedRssItem = {
  title: string;
  url: string;
  body: string;
  publishedAt: Date | null;
};

export async function fetchRssItems(
  source: Source,
): Promise<NormalizedRssItem[]> {
  const feed = await parser.parseURL(source.url);
  return (feed.items ?? []).slice(0, 25).map((item) => ({
    title: item.title?.trim() || "Untitled",
    url: item.link?.trim() || source.url,
    body: buildBody(item as RssItem),
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
  }));
}
