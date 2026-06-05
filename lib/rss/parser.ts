import Parser from "rss-parser";
import {
  feedRequestHeaders,
  FEED_REQUEST_TIMEOUT_MS,
  fetchFeedXml,
} from "@/lib/rss/fetch";

export type ParsedFeed = Parser.Output<Record<string, unknown>>;
export type ParsedItem = Parser.Item & Record<string, unknown>;

export const rssParser = new Parser<Record<string, unknown>, Record<string, unknown>>({
  timeout: FEED_REQUEST_TIMEOUT_MS,
  headers: feedRequestHeaders,
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

export async function parseFeedUrl(url: string) {
  return rssParser.parseString(await fetchFeedXml(url));
}
