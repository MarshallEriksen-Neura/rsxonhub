import { sql } from "drizzle-orm";
import type { Job } from "pg-boss";
import { analyzeArticle } from "@/lib/ai/article-analysis";
import { getEmbeddingConfig } from "@/lib/ai/config";
import {
  embedSingleArticle,
  rebuildArticleEmbeddings,
} from "@/lib/ai/embedding-rebuild";
import { db } from "@/lib/db";
import { articleSummaries, feeds } from "@/lib/db/schema";
import { generateDailyDigest } from "@/lib/digest/generate-digest";
import { startBoss } from "@/lib/jobs/boss";
import {
  JOB_NAMES,
  type ArticleAnalyzeJob,
  type ArticleEmbedJob,
  type DigestGenerateDailyJob,
  type FeedFetchOneJob,
} from "@/lib/jobs/names";
import { selectDigestCandidates } from "@/lib/retrieval/hybrid-candidates";
import { ingestFeed, type IngestFeedResult } from "@/lib/rss/ingest";

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

export async function enqueueArticleEmbedding(input: ArticleEmbedJob) {
  const boss = await startBoss();
  const singletonKey = input.rebuildRunId
    ? `embedding.rebuild:${input.rebuildRunId}`
    : `article.embed:${input.articleId}`;

  return boss.send(JOB_NAMES.articleEmbed, input, {
    retryLimit: 2,
    retryBackoff: true,
    singletonKey,
    singletonSeconds: 60 * 60,
  });
}

export type PostIngestEmbeddingResult = {
  enqueuedCount: number;
  skipped: boolean;
  error: string | null;
};

export async function enqueueChangedArticleEmbeddings(
  result: Pick<IngestFeedResult, "changedArticleIds">,
): Promise<PostIngestEmbeddingResult> {
  const articleIds = Array.from(new Set(result.changedArticleIds));
  if (articleIds.length === 0) {
    return { enqueuedCount: 0, skipped: true, error: null };
  }

  try {
    const config = await getEmbeddingConfig();
    if (!config.apiKey.trim()) {
      return {
        enqueuedCount: 0,
        skipped: true,
        error: "向量模型 API Key 未配置,已跳过后台 RAG 索引。",
      };
    }

    await Promise.all(articleIds.map((articleId) => enqueueArticleEmbedding({ articleId })));
    return { enqueuedCount: articleIds.length, skipped: false, error: null };
  } catch (error) {
    return {
      enqueuedCount: 0,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function enqueueDailyDigest(input: DigestGenerateDailyJob = {}) {
  const boss = await startBoss();
  const digestDate = input.digestDate ?? new Date().toISOString().slice(0, 10);
  return boss.send(
    JOB_NAMES.digestGenerateDaily,
    { digestDate },
    {
      retryLimit: 2,
      retryBackoff: true,
      singletonKey: `digest:${digestDate}`,
      singletonSeconds: 60 * 60 * 12,
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
          const result = await ingestFeed(job.data.feedId);
          await enqueueChangedArticleEmbeddings(result);
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

  await boss.work<ArticleEmbedJob>(
    JOB_NAMES.articleEmbed,
    async (jobs: Job<ArticleEmbedJob>[]) => {
      await Promise.all(
        jobs.map((job) => {
          if (job.data.rebuildRunId) {
            return rebuildArticleEmbeddings(job.data.rebuildRunId);
          }
          if (!job.data.articleId) {
            throw new Error("article.embed requires articleId or rebuildRunId");
          }
          return embedSingleArticle(job.data.articleId);
        }),
      );
    },
  );

  await boss.work<DigestGenerateDailyJob>(
    JOB_NAMES.digestGenerateDaily,
    async (jobs: Job<DigestGenerateDailyJob>[]) => {
      await Promise.all(jobs.map((job) => generateDailyDigest(job.data)));
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
