import Parser from "rss-parser";

export type ParsedFeed = Parser.Output<Record<string, unknown>>;
export type ParsedItem = Parser.Item & Record<string, unknown>;

const feedRequestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

export const rssParser = new Parser<Record<string, unknown>, Record<string, unknown>>({
  timeout: 15_000,
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
  return rssParser.parseURL(url);
}
