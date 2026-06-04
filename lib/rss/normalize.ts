import type { FeedSource } from "@/lib/rsshub/source-uri";
import type { ParsedFeed, ParsedItem } from "@/lib/rss/parser";
import { hashArticleContent, stableHash } from "@/lib/rss/hash";
import { sanitizeArticleHtml } from "@/lib/rss/sanitize";

export type NormalizedFeed = {
  title: string | null;
  siteUrl: string | null;
  sourceMeta: Record<string, unknown>;
};

export type NormalizedArticle = {
  guid: string;
  title: string | null;
  content: string | null;
  summaryRaw: string | null;
  url: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
  contentHash: string;
  sourceMeta: Record<string, unknown>;
};

export function normalizeFeed(feed: ParsedFeed, source: FeedSource): NormalizedFeed {
  return {
    title: stringOrNull(feed.title),
    siteUrl: stringOrNull(feed.link),
    sourceMeta: {
      sourceType: source.type,
      ...(source.type === "rsshub" ? { route: source.route } : {}),
    },
  };
}

export function normalizeItems(feedId: number, items: ParsedItem[], source: FeedSource) {
  return items.map((item, index) => normalizeItem(feedId, item, source, index));
}

export function normalizeItem(
  feedId: number,
  item: ParsedItem,
  source: FeedSource,
  index: number,
): NormalizedArticle {
  const title = stringOrNull(item.title);
  const url = stringOrNull(item.link);
  const summaryRaw = stringOrNull(item.contentSnippet) ?? stringOrNull(item.summary);
  const rawContent =
    stringOrNull(item.contentEncoded) ??
    stringOrNull(item.content) ??
    stringOrNull(item["content:encoded"]);
  // 入库前净化外部 HTML(放行图片/视频/可信 iframe),前端直接渲染净化结果。
  const content = sanitizeArticleHtml(rawContent);

  const article = {
    guid: normalizedGuid(feedId, item, title, url),
    title,
    content,
    summaryRaw,
    url,
    imageUrl: extractImageUrl(item),
    author: stringOrNull(item.creator) ?? stringOrNull(item.author),
    publishedAt: parseDate(item.isoDate ?? item.pubDate),
    sourceMeta: routeMetadata(source, index),
  };

  return {
    ...article,
    contentHash: hashArticleContent(article),
  };
}

function normalizedGuid(
  feedId: number,
  item: ParsedItem,
  title: string | null,
  url: string | null,
) {
  const guid = stringOrNull(item.guid) ?? stringOrNull(item.id) ?? url;
  if (guid) {
    return guid;
  }

  return stableHash(`${feedId}:${title ?? ""}:${url ?? ""}:${item.pubDate ?? ""}`);
}

function routeMetadata(source: FeedSource, index: number): Record<string, unknown> {
  if (source.type !== "rsshub") {
    return {};
  }

  const meta: Record<string, unknown> = {
    rsshubRoute: source.route,
  };

  if (source.route.startsWith("tophub/")) {
    meta.rank = index + 1;
    meta.latestSeenAt = new Date().toISOString();
  }

  return meta;
}

function extractImageUrl(item: ParsedItem) {
  const enclosure = item.enclosure;
  if (enclosure?.url) {
    return enclosure.url;
  }

  const mediaContent = item.mediaContent;
  if (hasUrl(mediaContent)) {
    return mediaContent.url;
  }

  const mediaThumbnail = item.mediaThumbnail;
  if (hasUrl(mediaThumbnail)) {
    return mediaThumbnail.url;
  }

  return null;
}

function hasUrl(value: unknown): value is { url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    value.url.length > 0
  );
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
