import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articles,
  feedFetchRuns,
  feeds,
  readStates,
  subscriptions,
} from "@/lib/db/schema";
import { logAppError, publicFeedErrorMessage } from "@/lib/errors/app-error-log";
import {
  normalizeFeedFetchStrategy,
  type FeedFetchStrategy,
} from "@/lib/rss/fetch-strategy";
import { parseFeedUrl } from "@/lib/rss/parser";
import { normalizeFeed, normalizeItems, type NormalizedArticle } from "@/lib/rss/normalize";
import { resolveFeedSource, SourceUriError, type FeedSource } from "@/lib/rsshub/source-uri";

export type SubscribeFeedInput = {
  sourceUri: string;
  title?: string;
  folder?: string;
  fetchStrategy?: FeedFetchStrategy;
};

export type IngestFeedResult = {
  feedId: number;
  itemCount: number;
  insertedCount: number;
  updatedCount: number;
  changedArticleIds: number[];
};

export async function subscribeFeed(input: SubscribeFeedInput) {
  const fetchStrategy = normalizeFeedFetchStrategy(input.fetchStrategy);
  const source = resolveSourceForStrategy(input.sourceUri, fetchStrategy);
  const parsed = await parseFeedUrl(source.fetchUrl, fetchOptionsForStrategy(fetchStrategy));
  const normalized = normalizeFeed(parsed, source);

  const [feed] = await db
    .insert(feeds)
    .values({
      url: source.canonicalUri,
      sourceType: source.type,
      fetchStrategy,
      sourceMeta: normalized.sourceMeta,
      title: input.title?.trim() || normalized.title,
      siteUrl: normalized.siteUrl,
    })
    .onConflictDoUpdate({
      target: feeds.url,
      set: {
        sourceType: source.type,
        fetchStrategy,
        sourceMeta: normalized.sourceMeta,
        title: input.title?.trim() || normalized.title,
        siteUrl: normalized.siteUrl,
      },
    })
    .returning();

  await db
    .insert(subscriptions)
    .values({
      feedId: feed.id,
      folder: input.folder?.trim() || null,
    })
    .onConflictDoNothing();

  return feed;
}

export async function ingestFeed(feedId: number): Promise<IngestFeedResult> {
  const [feed] = await db.select().from(feeds).where(eq(feeds.id, feedId)).limit(1);
  if (!feed) {
    throw new Error(`Feed not found: ${feedId}`);
  }

  const fetchStrategy = normalizeFeedFetchStrategy(feed.fetchStrategy);
  const source = resolveSourceForStrategy(feed.url, fetchStrategy);
  const [run] = await db
    .insert(feedFetchRuns)
    .values({ feedId, status: "running" })
    .returning();

  try {
    const parsed = await parseFeedUrl(source.fetchUrl, fetchOptionsForStrategy(fetchStrategy));
    const normalizedFeed = normalizeFeed(parsed, source);
    const normalizedItems = normalizeItems(feedId, parsed.items ?? [], source);
    const result = await upsertArticles(feedId, normalizedItems);

    await db
      .update(feeds)
      .set({
        sourceType: source.type,
        fetchStrategy,
        sourceMeta: normalizedFeed.sourceMeta,
        title: feed.title ?? normalizedFeed.title,
        siteUrl: normalizedFeed.siteUrl ?? feed.siteUrl,
        lastFetchedAt: sql`now()`,
        lastSuccessfulFetchedAt: sql`now()`,
        lastError: null,
      })
      .where(eq(feeds.id, feedId));

    await db
      .update(feedFetchRuns)
      .set({
        status: "success",
        finishedAt: sql`now()`,
        itemCount: normalizedItems.length,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
      })
      .where(eq(feedFetchRuns.id, run.id));

    return {
      feedId,
      itemCount: normalizedItems.length,
      ...result,
    };
  } catch (error) {
    await logAppError({
      source: "rss",
      operation: "ingestFeed",
      error,
      feedId,
      feedFetchRunId: run.id,
      details: {
        feedUrl: feed.url,
        fetchUrl: source.fetchUrl,
      },
    });

    await db
      .update(feeds)
      .set({
        lastFetchedAt: sql`now()`,
        lastError: publicFeedErrorMessage(error),
      })
      .where(eq(feeds.id, feedId));

    await db
      .update(feedFetchRuns)
      .set({
        status: "failed",
        finishedAt: sql`now()`,
        error: publicFeedErrorMessage(error),
      })
      .where(eq(feedFetchRuns.id, run.id));

    throw error;
  }
}

function resolveSourceForStrategy(url: string, strategy: FeedFetchStrategy): FeedSource {
  if (strategy === "browser") {
    throw new SourceUriError("浏览器抓取策略尚未接入。请先改用 RSSHub 或代理策略。");
  }

  const source = resolveFeedSource(url);
  if (strategy === "rsshub" && source.type !== "rsshub") {
    throw new SourceUriError("RSSHub 抓取策略需要把订阅源地址改为 rsshub:// URI。");
  }

  return source;
}

function fetchOptionsForStrategy(strategy: FeedFetchStrategy) {
  return {
    useProxy: strategy !== "direct",
  };
}

async function upsertArticles(feedId: number, items: NormalizedArticle[]) {
  if (items.length === 0) {
    return { insertedCount: 0, updatedCount: 0, changedArticleIds: [] };
  }

  const guids = items.map((item) => item.guid);
  const existing = await db
    .select({ guid: articles.guid })
    .from(articles)
    .where(and(eq(articles.feedId, feedId), inArray(articles.guid, guids)));
  const existingGuids = new Set(existing.map((row) => row.guid));

  return db.transaction(async (tx) => {
    let insertedCount = 0;
    let updatedCount = 0;
    const changedArticleIds: number[] = [];

    for (const item of items) {
      const [article] = await tx
        .insert(articles)
        .values({
          feedId,
          guid: item.guid,
          title: item.title,
          contentHash: item.contentHash,
          content: item.content,
          summaryRaw: item.summaryRaw,
          url: item.url,
          imageUrl: item.imageUrl,
          author: item.author,
          publishedAt: item.publishedAt,
          sourceMeta: item.sourceMeta,
          lastSeenAt: sql`now()`,
          fetchedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: [articles.feedId, articles.guid],
          set: {
            title: item.title,
            contentHash: item.contentHash,
            content: item.content,
            summaryRaw: item.summaryRaw,
            url: item.url,
            imageUrl: item.imageUrl,
            author: item.author,
            publishedAt: item.publishedAt,
            sourceMeta: item.sourceMeta,
            lastSeenAt: sql`now()`,
            fetchedAt: sql`now()`,
          },
        })
        .returning({ id: articles.id });

      changedArticleIds.push(article.id);

      if (existingGuids.has(item.guid)) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
        await tx
          .insert(readStates)
          .values({ articleId: article.id, status: "unread" })
          .onConflictDoNothing();
      }
    }

    return { insertedCount, updatedCount, changedArticleIds };
  });
}
