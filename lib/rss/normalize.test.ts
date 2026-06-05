import { describe, expect, test } from "bun:test";
import { normalizeItem } from "@/lib/rss/normalize";
import type { FeedSource } from "@/lib/rsshub/source-uri";

const rsshubSource: FeedSource = {
  type: "rsshub",
  canonicalUri: "rsshub://tophub/WnBe01o371",
  route: "tophub/WnBe01o371",
  fetchUrl: "https://rsshub.example/tophub/WnBe01o371",
};

describe("RSS item normalization", () => {
  test("stores TopHub rank metadata and stable content hash", () => {
    const item = normalizeItem(
      7,
      {
        title: "Ranked item",
        link: "https://example.com/ranked",
        guid: "ranked-guid",
        contentSnippet: "Snapshot item",
      },
      rsshubSource,
      2,
    );

    expect(item.guid).toBe("ranked-guid");
    expect(item.sourceMeta.rank).toBe(3);
    expect(item.sourceMeta.rsshubRoute).toBe("tophub/WnBe01o371");
    expect(typeof item.sourceMeta.latestSeenAt).toBe("string");
    expect(item.contentHash).toHaveLength(64);
  });

  test("preserves Anthropic-style published dates when provided", () => {
    const item = normalizeItem(
      9,
      {
        title: "Research note",
        link: "https://anthropic.com/research/demo",
        isoDate: "2026-06-01T12:30:00.000Z",
        content: "<p>Research content</p>",
      },
      {
        type: "rsshub",
        canonicalUri: "rsshub://anthropic/research",
        route: "anthropic/research",
        fetchUrl: "https://rsshub.example/anthropic/research",
      },
      0,
    );

    expect(item.publishedAt?.toISOString()).toBe("2026-06-01T12:30:00.000Z");
    expect(item.sourceMeta.rank).toBeUndefined();
    expect(item.content).toContain("Research content");
  });
});