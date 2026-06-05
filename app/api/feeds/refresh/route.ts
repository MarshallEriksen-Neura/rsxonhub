import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { feeds } from "@/lib/db/schema";
import { enqueueChangedArticleEmbeddings } from "@/lib/jobs/feed-jobs";
import { ingestFeed } from "@/lib/rss/ingest";

const refreshFeedSchema = z.object({
  feedId: z.coerce.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const parsed = refreshFeedSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const results = parsed.data.feedId
      ? [await refreshOneFeed(parsed.data.feedId)]
      : await refreshAllFeeds();

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "REFRESH_FEED_FAILED", message },
      { status: 500 },
    );
  }
}

async function refreshOneFeed(feedId: number) {
  const ingest = await ingestFeed(feedId);
  const embeddingIndex = await enqueueChangedArticleEmbeddings(ingest);
  return { ...ingest, embeddingIndex };
}

async function refreshAllFeeds() {
  const rows = await db.select({ id: feeds.id }).from(feeds);
  const results = [];
  for (const feed of rows) {
    results.push(await refreshOneFeed(feed.id));
  }
  return results;
}
