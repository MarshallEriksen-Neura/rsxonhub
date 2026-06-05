import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const dbTest = process.env.RUN_DB_TESTS === "1" ? test : test.skip;

describe("RSS ingestion DB integration", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;
  let feedId: number | null = null;

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(rssFixture(), {
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      },
    });
  });

  afterAll(async () => {
    if (feedId && process.env.RUN_DB_TESTS === "1") {
      const { eq } = await import("drizzle-orm");
      const { db } = await import("@/lib/db");
      const { feeds } = await import("@/lib/db/schema");
      await db.delete(feeds).where(eq(feeds.id, feedId));
    }
    server?.stop(true);
  });

  dbTest("upserts repeated fetches without duplicate articles and records fetch runs", async () => {
    if (!server) throw new Error("fixture server not started");

    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");
    const { articles, feedFetchRuns, feeds, readStates } = await import("@/lib/db/schema");
    const { ingestFeed } = await import("@/lib/rss/ingest");

    const [feed] = await db
      .insert(feeds)
      .values({
        url: `http://127.0.0.1:${server.port}/feed.xml`,
        title: "Fixture Feed",
      })
      .returning({ id: feeds.id });
    feedId = feed.id;

    const first = await ingestFeed(feed.id);
    const second = await ingestFeed(feed.id);

    expect(first.insertedCount).toBe(2);
    expect(first.updatedCount).toBe(0);
    expect(second.insertedCount).toBe(0);
    expect(second.updatedCount).toBe(2);

    const articleRows = await db
      .select({ id: articles.id, publishedAt: articles.publishedAt })
      .from(articles)
      .where(eq(articles.feedId, feed.id));
    expect(articleRows).toHaveLength(2);
    expect(articleRows.every((row) => row.publishedAt instanceof Date)).toBe(true);

    const readRows = await db
      .select({ id: readStates.id })
      .from(readStates)
      .innerJoin(articles, eq(articles.id, readStates.articleId))
      .where(eq(articles.feedId, feed.id));
    expect(readRows).toHaveLength(2);

    const runs = await db
      .select({ status: feedFetchRuns.status })
      .from(feedFetchRuns)
      .where(eq(feedFetchRuns.feedId, feed.id));
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.status === "success")).toBe(true);
  });
});

function rssFixture() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Feed</title>
    <link>https://example.com</link>
    <item>
      <guid>item-1</guid>
      <title>First item</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
      <description>First summary</description>
    </item>
    <item>
      <guid>item-2</guid>
      <title>Second item</title>
      <link>https://example.com/2</link>
      <pubDate>Tue, 02 Jun 2026 12:00:00 GMT</pubDate>
      <description>Second summary</description>
    </item>
  </channel>
</rss>`;
}
