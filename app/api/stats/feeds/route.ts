import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, feedFetchRuns, feeds, readStates, subscriptions } from "@/lib/db/schema";

/**
 * GET /api/stats/feeds
 * 返回 Feed 健康监控 + 活跃度分析所需聚合数据。
 */
export async function GET() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. 每个 feed 基本信息 + 30 天文章产量 + 未读数
  const feedStats = await db
    .select({
      id: feeds.id,
      title: feeds.title,
      url: feeds.url,
      lastSuccessfulFetchedAt: feeds.lastSuccessfulFetchedAt,
      lastError: feeds.lastError,
      articleCount: count(articles.id),
    })
    .from(feeds)
    .innerJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
    .leftJoin(
      articles,
      and(eq(articles.feedId, feeds.id), gte(articles.fetchedAt, since30d)),
    )
    .groupBy(feeds.id)
    .orderBy(desc(count(articles.id)));

  // 2. 每个 feed 的阅读数（30 天内）
  const readCounts = await db
    .select({
      feedId: articles.feedId,
      readCount: count(readStates.id),
    })
    .from(readStates)
    .innerJoin(articles, eq(articles.id, readStates.articleId))
    .where(
      and(
        eq(readStates.status, "read"),
        gte(articles.fetchedAt, since30d),
      ),
    )
    .groupBy(articles.feedId);

  const readMap = new Map(readCounts.map((r) => [r.feedId, r.readCount]));

  // 3. 每个 feed 最近 10 次抓取的成功率
  const recentRuns = await db
    .select({
      feedId: feedFetchRuns.feedId,
      status: feedFetchRuns.status,
    })
    .from(feedFetchRuns)
    .where(gte(feedFetchRuns.startedAt, since30d))
    .orderBy(desc(feedFetchRuns.startedAt));

  const runsMap = new Map<number, { success: number; failed: number }>();
  for (const run of recentRuns) {
    const cur = runsMap.get(run.feedId) ?? { success: 0, failed: 0 };
    if (run.status === "success") cur.success++;
    else if (run.status === "failed") cur.failed++;
    runsMap.set(run.feedId, cur);
  }

  // 4. 近 30 天每日新文章数（全局趋势折线图）
  const dailyArticles = await db
    .select({
      day: sql<string>`to_char(${articles.fetchedAt}, 'MM-DD')`.as("day"),
      count: count(articles.id),
    })
    .from(articles)
    .where(gte(articles.fetchedAt, since30d))
    .groupBy(sql`to_char(${articles.fetchedAt}, 'MM-DD')`)
    .orderBy(sql`to_char(${articles.fetchedAt}, 'MM-DD')`);

  const feeds30d = feedStats.map((f) => ({
    id: f.id,
    title: f.title ?? f.url,
    articleCount: f.articleCount,
    readCount: readMap.get(f.id) ?? 0,
    readRate:
      f.articleCount > 0
        ? Math.round(((readMap.get(f.id) ?? 0) / f.articleCount) * 100)
        : 0,
    successRuns: runsMap.get(f.id)?.success ?? 0,
    failedRuns: runsMap.get(f.id)?.failed ?? 0,
    lastSuccessfulFetchedAt: f.lastSuccessfulFetchedAt,
    hasError: Boolean(f.lastError),
    daysSinceSuccess: f.lastSuccessfulFetchedAt
      ? Math.floor(
          (Date.now() - new Date(f.lastSuccessfulFetchedAt).getTime()) /
            86_400_000,
        )
      : null,
  }));

  return NextResponse.json({ feeds: feeds30d, dailyArticles });
}
