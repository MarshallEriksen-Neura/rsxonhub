import Parser from "rss-parser";

export type ParsedFeed = Parser.Output<Record<string, unknown>>;
export type ParsedItem = Parser.Item & Record<string, unknown>;

export const rssParser = new Parser<Record<string, unknown>, Record<string, unknown>>({
  timeout: 15_000,
  headers: {
    "User-Agent": "rsxonhub/0.1 (+https://github.com)",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

export async function parseFeedUrl(url: string) {
  return rssParser.parseURL(url);
}
