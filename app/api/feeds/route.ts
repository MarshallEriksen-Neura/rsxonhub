import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { articles, feeds, readStates, subscriptions } from "@/lib/db/schema";
import { logAppError, publicFeedErrorResponse } from "@/lib/errors/app-error-log";
import { enqueueChangedArticleEmbeddings } from "@/lib/jobs/feed-jobs";
import { FEED_FETCH_STRATEGIES } from "@/lib/rss/fetch-strategy";
import { ingestFeed, subscribeFeed } from "@/lib/rss/ingest";
import { resolveFeedSource, SourceUriError } from "@/lib/rsshub/source-uri";

const configurableFetchStrategySchema = z
  .enum(FEED_FETCH_STRATEGIES)
  .refine((value) => value !== "browser", {
    message: "浏览器抓取策略尚未接入。",
  });

const createFeedSchema = z.object({
  sourceUri: z.string().trim().min(1),
  title: z.string().trim().optional(),
  folder: z.string().trim().min(1).optional(),
  fetchStrategy: configurableFetchStrategySchema.optional(),
});

const updateFeedSchema = z.object({
  id: z.coerce.number().int().positive(),
  sourceUri: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  folder: z.string().trim().min(1).nullable().optional(),
  fetchInterval: z.coerce.number().int().min(60).max(86_400).optional(),
  fetchStrategy: configurableFetchStrategySchema.optional(),
});

export async function GET() {
  const rows = await db
    .select({
      id: feeds.id,
      title: feeds.title,
      url: feeds.url,
      sourceType: feeds.sourceType,
      fetchStrategy: feeds.fetchStrategy,
      folder: subscriptions.folder,
      fetchInterval: feeds.fetchInterval,
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
    const result = await ingestFeed(feed.id);
    const embeddingIndex = await enqueueChangedArticleEmbeddings(result);

    return NextResponse.json({
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        folder: parsed.data.folder,
        unread: result.insertedCount,
      },
      ingest: result,
      embeddingIndex,
    });
  } catch (error) {
    if (error instanceof SourceUriError) {
      return NextResponse.json(
        { error: "INVALID_SOURCE_URI", message: error.message },
        { status: 400 },
      );
    }

    await logAppError({
      source: "api",
      operation: "feeds.POST",
      error,
      details: {
        sourceUri: parsed.data.sourceUri,
        title: parsed.data.title,
        folder: parsed.data.folder,
      },
    });
    return publicFeedErrorResponse("CREATE_FEED_FAILED", 500, error);
  }
}

export async function PATCH(request: Request) {
  const parsed = updateFeedSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id, sourceUri, title, folder, fetchInterval, fetchStrategy } = parsed.data;
  let source: ReturnType<typeof resolveFeedSource> | null = null;
  if (sourceUri !== undefined) {
    try {
      source = resolveFeedSource(sourceUri);
    } catch (error) {
      if (error instanceof SourceUriError) {
        return NextResponse.json(
          { error: "INVALID_SOURCE_URI", message: error.message },
          { status: 400 },
        );
      }
      throw error;
    }
  }
  if (fetchStrategy === "rsshub") {
    const sourceType =
      source?.type ??
      (
        await db
          .select({ sourceType: feeds.sourceType })
          .from(feeds)
          .where(eq(feeds.id, id))
          .limit(1)
      )[0]?.sourceType;

    if (sourceType !== "rsshub") {
      return NextResponse.json(
        {
          error: "INVALID_FETCH_STRATEGY",
          message: "RSSHub 抓取策略需要把订阅源地址改为 rsshub:// URI。",
        },
        { status: 400 },
      );
    }
  }

  await db.transaction(async (tx) => {
    if (
      title !== undefined ||
      fetchInterval !== undefined ||
      fetchStrategy !== undefined ||
      source !== null
    ) {
      await tx
        .update(feeds)
        .set({
          ...(source !== null
            ? {
                url: source.canonicalUri,
                sourceType: source.type,
                sourceMeta: source.type === "rsshub" ? { rsshubRoute: source.route } : null,
                lastError: null,
              }
            : {}),
          ...(title !== undefined ? { title } : {}),
          ...(fetchInterval !== undefined ? { fetchInterval } : {}),
          ...(fetchStrategy !== undefined ? { fetchStrategy } : {}),
        })
        .where(eq(feeds.id, id));
    }

    if (folder !== undefined) {
      await tx
        .insert(subscriptions)
        .values({ feedId: id, folder })
        .onConflictDoUpdate({
          target: subscriptions.feedId,
          set: { folder },
        });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  await db.delete(feeds).where(eq(feeds.id, id));
  return NextResponse.json({ ok: true });
}
