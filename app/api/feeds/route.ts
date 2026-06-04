import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { articles, feeds, readStates, subscriptions } from "@/lib/db/schema";
import { enqueueFeedFetch } from "@/lib/jobs/feed-jobs";
import { subscribeFeed } from "@/lib/rss/ingest";
import { SourceUriError } from "@/lib/rsshub/source-uri";

const createFeedSchema = z.object({
  sourceUri: z.string().trim().min(1),
  title: z.string().trim().optional(),
  folder: z.string().trim().min(1).optional(),
});

export async function GET() {
  const rows = await db
    .select({
      id: feeds.id,
      title: feeds.title,
      url: feeds.url,
      folder: subscriptions.folder,
      lastFetchedAt: feeds.lastFetchedAt,
      lastSuccessfulFetchedAt: feeds.lastSuccessfulFetchedAt,
      lastError: feeds.lastError,
      unread: sql<number>`count(${readStates.id}) filter (where ${readStates.status} = 'unread')`,
    })
    .from(feeds)
    .leftJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
    .leftJoin(articles, eq(articles.feedId, feeds.id))
    .leftJoin(readStates, eq(readStates.articleId, articles.id))
    .groupBy(feeds.id, subscriptions.folder)
    .orderBy(desc(feeds.createdAt));

  return NextResponse.json({ feeds: rows });
}

export async function POST(request: Request) {
  const parsed = createFeedSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const feed = await subscribeFeed(parsed.data);
    await enqueueFeedFetch(feed.id);

    return NextResponse.json({
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        folder: parsed.data.folder,
        unread: 0,
      },
    });
  } catch (error) {
    if (error instanceof SourceUriError) {
      return NextResponse.json(
        { error: "INVALID_SOURCE_URI", message: error.message },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "CREATE_FEED_FAILED", message },
      { status: 500 },
    );
  }
}
