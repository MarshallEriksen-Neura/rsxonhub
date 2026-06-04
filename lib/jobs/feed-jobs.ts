import { sql } from "drizzle-orm";
import type { Job } from "pg-boss";
import { db } from "@/lib/db";
import { articleSummaries, feeds } from "@/lib/db/schema";
import { startBoss } from "@/lib/jobs/boss";
import {
  JOB_NAMES,
  type ArticleAnalyzeJob,
  type FeedFetchOneJob,
} from "@/lib/jobs/names";
import { ingestFeed } from "@/lib/rss/ingest";
import { analyzeArticle } from "@/lib/ai/article-analysis";
import { selectDigestCandidates } from "@/lib/retrieval/hybrid-candidates";

export async function enqueueFeedFetch(feedId: number) {
  const boss = await startBoss();
  return boss.send(
    JOB_NAMES.feedFetchOne,
    { feedId } satisfies FeedFetchOneJob,
    {
      retryLimit: 3,
      retryBackoff: true,
      singletonKey: `feed:${feedId}`,
      singletonSeconds: 60 * 10,
    },
  );
}

export async function enqueueArticleAnalysis(articleId: number) {
  const boss = await startBoss();
  return boss.send(
    JOB_NAMES.articleAnalyze,
    { articleId } satisfies ArticleAnalyzeJob,
    {
      retryLimit: 2,
      retryBackoff: true,
      singletonKey: `article.analyze:${articleId}`,
      singletonSeconds: 60 * 30,
    },
  );
}

export async function enqueueDueFeedScan() {
  const boss = await startBoss();
  return boss.send(
    JOB_NAMES.feedFetchDue,
    {},
    {
      singletonKey: "feed.fetch-due",
      singletonSeconds: 60,
    },
  );
}

export async function registerFeedJobs() {
  const boss = await startBoss();

  await boss.work(JOB_NAMES.feedFetchDue, async () => {
    const dueFeeds = await db
      .select({ id: feeds.id })
      .from(feeds)
      .where(
        sql`${feeds.lastFetchedAt} is null or ${feeds.lastFetchedAt} < now() - (${feeds.fetchInterval} * interval '1 second')`,
      );

    await Promise.all(dueFeeds.map((feed) => enqueueFeedFetch(feed.id)));
  });

  await boss.work<FeedFetchOneJob>(
    JOB_NAMES.feedFetchOne,
    async (jobs: Job<FeedFetchOneJob>[]) => {
      await Promise.all(
        jobs.map(async (job) => {
          await ingestFeed(job.data.feedId);
          await enqueueAnalysisForCurrentCandidates();
        }),
      );
    },
  );

  await boss.work<ArticleAnalyzeJob>(
    JOB_NAMES.articleAnalyze,
    async (jobs: Job<ArticleAnalyzeJob>[]) => {
      await Promise.all(jobs.map((job) => analyzeArticle(job.data.articleId)));
    },
  );
}

export async function enqueueAnalysisForCurrentCandidates() {
  const candidates = await selectDigestCandidates();
  if (candidates.length === 0) return 0;

  const pending = await db
    .select({ articleId: articleSummaries.articleId })
    .from(articleSummaries)
    .where(sql`${articleSummaries.status} = 'pending'`);
  const pendingIds = new Set(pending.map((row) => row.articleId));

  let enqueued = 0;
  for (const candidate of candidates) {
    if (pendingIds.has(candidate.articleId)) continue;
    await enqueueArticleAnalysis(candidate.articleId);
    enqueued += 1;
  }

  return enqueued;
}
