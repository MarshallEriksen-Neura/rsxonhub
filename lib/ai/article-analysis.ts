import { generateObject } from "ai";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { chatModel, withAIRequestRetry } from "@/lib/ai";
import { getChatConfig } from "@/lib/ai/config";
import { db } from "@/lib/db";
import {
  articleRelevanceScores,
  articleSummaries,
  articles,
  feeds,
  usageLogs,
} from "@/lib/db/schema";

export const ARTICLE_SUMMARY_PROMPT_VERSION = "article-summary-v1";
const DEFAULT_ARTICLE_ANALYSIS_TIMEOUT_MS = 75_000;

const articleAnalysisSchema = z.object({
  summary: z.string().min(1).max(800),
  bullets: z.array(z.string().min(1).max(240)).max(5),
  tags: z.array(z.string().min(1).max(40)).max(6),
  importance: z.number().int().min(0).max(100),
});

export type AnalyzeArticleResult = z.infer<typeof articleAnalysisSchema>;

export async function analyzeArticle(articleId: number) {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      contentHash: articles.contentHash,
      content: articles.content,
      summaryRaw: articles.summaryRaw,
      publishedAt: articles.publishedAt,
      feedTitle: feeds.title,
      relevanceFeatures: articleRelevanceScores.features,
      combinedScore: articleRelevanceScores.combinedScore,
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(articleRelevanceScores, eq(articleRelevanceScores.articleId, articles.id))
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  const config = await getChatConfig();
  const [existing] = await db
    .select({ id: articleSummaries.id })
    .from(articleSummaries)
    .where(eq(articleSummaries.articleId, articleId))
    .limit(1);

  if (existing && article.contentHash) {
    const [completed] = await db
      .select({ id: articleSummaries.id })
      .from(articleSummaries)
      .where(
        sql`${articleSummaries.articleId} = ${articleId}
          and ${articleSummaries.status} = 'complete'
          and ${articleSummaries.contentHash} = ${article.contentHash}
          and ${articleSummaries.promptVersion} = ${ARTICLE_SUMMARY_PROMPT_VERSION}
          and ${articleSummaries.model} = ${config.model}`,
      )
      .limit(1);
    if (completed) {
      return { skipped: true as const, reason: "already_complete" };
    }
  }

  await upsertSummaryStatus(articleId, {
    status: "pending",
    contentHash: article.contentHash,
    promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
    model: config.model,
    error: null,
  });

  try {
    const model = await chatModel();
    const result = await withArticleAnalysisTimeout(
      withAIRequestRetry(() =>
        generateObject({
          model,
          schema: articleAnalysisSchema,
          temperature: 0.7,
          topP: 1,
          system:
            "你是单用户 RSS 阅读器的文章分析器。只基于给定文章证据输出摘要、要点、标签和重要度；不要引入外部事实。",
          prompt: buildPrompt(article),
        }),
      ),
    );

    const analysis = result.object;
    const usage = result.usage;
    const tokenCost = usage
      ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
      : null;

    await upsertSummaryStatus(articleId, {
      ...analysis,
      status: "complete",
      contentHash: article.contentHash,
      promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
      model: config.model,
      tokenCost,
      error: null,
    });

    await db.insert(usageLogs).values({
      kind: "summary",
      model: config.model,
      tokens: tokenCost,
      cost: null,
    });

    return { skipped: false as const, result: analysis };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertSummaryStatus(articleId, {
      status: "failed",
      contentHash: article.contentHash,
      promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
      model: config.model,
      error: message,
    });
    throw error;
  }
}

async function upsertSummaryStatus(
  articleId: number,
  values: Partial<typeof articleSummaries.$inferInsert>,
) {
  await db
    .insert(articleSummaries)
    .values({
      articleId,
      ...values,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: articleSummaries.articleId,
      set: {
        ...values,
        updatedAt: sql`now()`,
      },
    });
}

function buildPrompt(article: {
  title: string | null;
  url: string | null;
  content: string | null;
  summaryRaw: string | null;
  publishedAt: Date | null;
  feedTitle: string | null;
  relevanceFeatures: Record<string, unknown> | null;
  combinedScore: number | null;
}) {
  return JSON.stringify(
    {
      feedTitle: article.feedTitle,
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      retrieval: {
        combinedScore: article.combinedScore,
        features: article.relevanceFeatures ?? {},
      },
      articleText: compactText(article.content ?? article.summaryRaw ?? ""),
    },
    null,
    2,
  );
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 8_000);
}

function withArticleAnalysisTimeout<T>(promise: Promise<T>) {
  const timeoutMs = articleAnalysisTimeoutMs();
  let timeout: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(
          `Article summary generation timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

function articleAnalysisTimeoutMs() {
  const raw = Number(process.env.ARTICLE_ANALYSIS_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_ARTICLE_ANALYSIS_TIMEOUT_MS;
}
