import { describe, expect, test } from "bun:test";
import { parseOpmlSubscriptions } from "@/lib/rss/opml";

describe("parseOpmlSubscriptions", () => {
  test("extracts subscriptions and inherits folder names", () => {
    const opml = `<?xml version="1.0"?>
      <opml version="2.0">
        <body>
          <outline text="Tech">
            <outline text="Example" xmlUrl="https://example.com/rss.xml" />
            <outline title="RSSHub Feed" xmlUrl="rsshub://anthropic/research" />
          </outline>
        </body>
      </opml>`;

    expect(parseOpmlSubscriptions(opml, "Fallback")).toEqual([
      {
        title: "Example",
        sourceUri: "https://example.com/rss.xml",
        folder: "Tech",
      },
      {
        title: "RSSHub Feed",
        sourceUri: "rsshub://anthropic/research",
        folder: "Tech",
      },
    ]);
  });

  test("uses fallback folder and decodes xml entities", () => {
    const opml = `
      <opml><body>
        <outline text="A &amp; B" xmlUrl="https://example.com/feed?a=1&amp;b=2"></outline>
        <outline text="Duplicate" xmlUrl="https://example.com/feed?a=1&amp;b=2" />
      </body></opml>`;

    expect(parseOpmlSubscriptions(opml, "Imported")).toEqual([
      {
        title: "A & B",
        sourceUri: "https://example.com/feed?a=1&b=2",
        folder: "Imported",
      },
    ]);
  });
});
