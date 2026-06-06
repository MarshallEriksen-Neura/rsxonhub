import { describe, expect, test } from "bun:test";
import { buildOpmlExport } from "@/lib/rss/opml-export";
import { parseOpmlSubscriptions } from "@/lib/rss/opml";

describe("buildOpmlExport", () => {
  test("exports grouped subscriptions as importable OPML", () => {
    const opml = buildOpmlExport(
      [
        {
          title: "Nature",
          url: "https://www.nature.com/nature.rss",
          folder: "学术论文",
        },
        {
          title: "ByteByteGo",
          url: "https://blog.bytebytego.com/feed",
          folder: "技术周刊",
        },
      ],
      new Date("2026-06-06T12:00:00.000Z"),
    );

    expect(opml).toContain(`<dateCreated>2026-06-06T12:00:00.000Z</dateCreated>`);
    expect(parseOpmlSubscriptions(opml)).toEqual([
      {
        title: "Nature",
        sourceUri: "https://www.nature.com/nature.rss",
        folder: "学术论文",
      },
      {
        title: "ByteByteGo",
        sourceUri: "https://blog.bytebytego.com/feed",
        folder: "技术周刊",
      },
    ]);
  });

  test("escapes xml attributes and falls back to feed url as title", () => {
    const url = "https://example.com/feed?a=1&b=2";
    const opml = buildOpmlExport(
      [
        {
          title: `A "quoted" <feed> & more`,
          url,
          folder: null,
        },
        {
          title: null,
          url: "rsshub://example/route",
          folder: "RSSHub",
        },
      ],
      new Date("2026-06-06T12:00:00.000Z"),
    );

    expect(opml).toContain(`text="A &quot;quoted&quot; &lt;feed&gt; &amp; more"`);
    expect(opml).toContain(`xmlUrl="https://example.com/feed?a=1&amp;b=2"`);
    expect(parseOpmlSubscriptions(opml)).toEqual([
      {
        title: `A "quoted" <feed> & more`,
        sourceUri: url,
        folder: "未分组",
      },
      {
        title: "rsshub://example/route",
        sourceUri: "rsshub://example/route",
        folder: "RSSHub",
      },
    ]);
  });
});
