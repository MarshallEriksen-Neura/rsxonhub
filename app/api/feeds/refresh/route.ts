import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { feeds } from "@/lib/db/schema";
import { logAppError, publicFeedErrorResponse } from "@/lib/errors/app-error-log";
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
    await logAppError({
      source: "api",
      operation: "feeds.refresh.POST",
      error,
      feedId: parsed.data.feedId,
    });
    return publicFeedErrorResponse("REFRESH_FEED_FAILED", 500);
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
