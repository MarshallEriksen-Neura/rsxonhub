import { embed, embedMany } from "ai";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  embeddingModelWithConfig,
  withAIRequestRetry,
} from "@/lib/ai";
import { getEmbeddingConfig, type EmbeddingRuntimeConfig } from "@/lib/ai/config";
import {
  advanceEmbeddingRebuildProgress,
  type EmbeddingRebuildProgress,
} from "@/lib/ai/embedding-rebuild-progress";
import { chunkArticleText, expectedEmbeddingDimension } from "@/lib/ai/embedding-text";
import { db } from "@/lib/db";
import {
  articleChunks,
  articles,
  interestProfiles,
  embeddingRebuildRuns,
  usageLogs,
} from "@/lib/db/schema";

const EMBED_BATCH_SIZE = 16;
const REBUILD_ARTICLE_PAGE_SIZE = 25;

export type EmbeddingChangeCheck = {
  changed: boolean;
  probedDimension: number;
  expectedDimension: number;
  existingChunkCount: number;
  requiresRebuild: boolean;
};

export async function probeEmbeddingDimension(config?: EmbeddingRuntimeConfig) {
  const { model } = await embeddingModelWithConfig("query", config);
  const result = await withAIRequestRetry(() =>
    embed({
      model,
      value: "dimension probe",
    }),
  );

  return result.embedding.length;
}

export async function getEmbeddingVectorDimension(
  tableName: "article_chunks" | "interest_profiles" = "interest_profiles",
) {
  const [row] = await db.execute<{ dimension: number | null }>(sql`
    select a.atttypmod::int as dimension
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = ${tableName}
      and a.attname = 'embedding'
      and not a.attisdropped
    limit 1
  `);
  const dimension = Number(row?.dimension);
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error(`无法读取 ${tableName}.embedding 的向量维度。`);
  }
  return dimension;
}

export async function createEmbeddingRebuildRun() {
  const config = await getEmbeddingConfig();
  const totalArticleCount = await countEmbeddingSourceArticles();
  const [run] = await db
    .insert(embeddingRebuildRuns)
    .values({
      status: "pending",
      model: config.model,
      baseUrl: config.baseUrl,
      dimension: config.dimension,
      totalArticleCount,
    })
    .returning();

  return run;
}

export async function attachEmbeddingRebuildRunJob(runId: number, jobId: string) {
  await db
    .update(embeddingRebuildRuns)
    .set({ jobId })
    .where(eq(embeddingRebuildRuns.id, runId));
}

export async function markEmbeddingRebuildRunFailed(runId: number, error: unknown) {
  await db
    .update(embeddingRebuildRuns)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: sql`now()`,
    })
    .where(eq(embeddingRebuildRuns.id, runId));
}

export async function prepareEmbeddingDimensionRebuild(dimension: number) {
  assertSupportedVectorDimension(dimension);

  await db.transaction(async (tx) => {
    await tx.delete(articleChunks);
    await tx
      .update(interestProfiles)
      .set({ embedding: null, updatedAt: sql`now()` });
    await tx.execute(
      sql.raw(
        `ALTER TABLE "article_chunks" ALTER COLUMN "embedding" TYPE vector(${dimension}) USING NULL::vector(${dimension})`,
      ),
    );
    await tx.execute(
      sql.raw(
        `ALTER TABLE "interest_profiles" ALTER COLUMN "embedding" TYPE vector(${dimension}) USING NULL::vector(${dimension})`,
      ),
    );
  });
}

export async function getLatestEmbeddingRebuildRun() {
  const [run] = await db
    .select()
    .from(embeddingRebuildRuns)
    .orderBy(desc(embeddingRebuildRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function rebuildArticleEmbeddings(rebuildRunId?: number) {
  const run = rebuildRunId ? await getRebuildRun(rebuildRunId) : null;
  const totalArticleCount = run?.totalArticleCount || await countEmbeddingSourceArticles();
  let progress: EmbeddingRebuildProgress = {
    articleCount: run?.articleCount ?? 0,
    chunkCount: run?.chunkCount ?? 0,
    lastProcessedArticleId: run?.lastProcessedArticleId ?? 0,
  };

  if (run) {
    await db
      .update(embeddingRebuildRuns)
      .set({
        status: "running",
        startedAt: sql`coalesce(${embeddingRebuildRuns.startedAt}, now())`,
        finishedAt: null,
        error: null,
        totalArticleCount,
      })
      .where(eq(embeddingRebuildRuns.id, run.id));
  }

  try {
    while (true) {
      const rows = await getNextRebuildArticles(progress.lastProcessedArticleId);
      if (rows.length === 0) break;

      for (const article of rows) {
        const result = await embedArticle(
          article.id,
          buildArticleEmbeddingText(article),
          article.title ?? undefined,
        );
        progress = advanceEmbeddingRebuildProgress(progress, {
          articleId: article.id,
          chunkCount: result.chunkCount,
        });

        if (run) {
          await updateEmbeddingRebuildRunProgress(run.id, progress);
        }
      }
    }

    if (run) {
      await db
        .update(embeddingRebuildRuns)
        .set({
          status: "complete",
          articleCount: progress.articleCount,
          chunkCount: progress.chunkCount,
          lastProcessedArticleId: progress.lastProcessedArticleId,
          finishedAt: sql`now()`,
          error: null,
        })
        .where(eq(embeddingRebuildRuns.id, run.id));
    }

    return {
      articleCount: progress.articleCount,
      chunkCount: progress.chunkCount,
    };
  } catch (error) {
    if (run) {
      await db
        .update(embeddingRebuildRuns)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          finishedAt: sql`now()`,
        })
        .where(eq(embeddingRebuildRuns.id, run.id));
    }
    throw error;
  }
}

export async function embedSingleArticle(articleId: number) {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      summaryRaw: articles.summaryRaw,
      content: articles.content,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  return embedArticle(article.id, buildArticleEmbeddingText(article), article.title ?? undefined);
}

export async function retrieveArticleChunks(query: string, limit = 8) {
  const { model } = await embeddingModelWithConfig("query");
  const result = await withAIRequestRetry(() =>
    embed({
      model,
      value: query,
    }),
  );

  return db
    .select({
      articleId: articleChunks.articleId,
      chunkIndex: articleChunks.chunkIndex,
      content: articleChunks.content,
      distance: sql<number>`${articleChunks.embedding} <=> ${JSON.stringify(result.embedding)}::vector`,
    })
    .from(articleChunks)
    .where(sql`${articleChunks.embedding} is not null`)
    .orderBy(sql`${articleChunks.embedding} <=> ${JSON.stringify(result.embedding)}::vector`)
    .limit(limit);
}

async function embedArticle(articleId: number, text: string, title?: string) {
  const chunks = chunkArticleText(text, title);
  if (chunks.length === 0) {
    await db.delete(articleChunks).where(eq(articleChunks.articleId, articleId));
    return { articleId, chunkCount: 0 };
  }

  const { config, model } = await embeddingModelWithConfig("passage");
  let tokenCount = 0;

  for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
    const values = chunks.slice(start, start + EMBED_BATCH_SIZE);
    const result = await withAIRequestRetry(() =>
      embedMany({
        model,
        values,
        maxParallelCalls: 2,
      }),
    );
    tokenCount += result.usage?.tokens ?? 0;

    await db.transaction(async (tx) => {
      for (const [offset, embedding] of result.embeddings.entries()) {
        const chunkIndex = start + offset;
        await tx
          .insert(articleChunks)
          .values({
            articleId,
            chunkIndex,
            content: values[offset],
            embedding,
          })
          .onConflictDoUpdate({
            target: [articleChunks.articleId, articleChunks.chunkIndex],
            set: {
              content: values[offset],
              embedding,
            },
          });
      }
    });
  }

  await db
    .delete(articleChunks)
    .where(and(eq(articleChunks.articleId, articleId), gt(articleChunks.chunkIndex, chunks.length - 1)));

  await db.insert(usageLogs).values({
    kind: "embedding",
    model: config.model,
    tokens: tokenCount || null,
    cost: null,
  });

  return { articleId, chunkCount: chunks.length };
}

async function getRebuildRun(id: number) {
  const [run] = await db
    .select()
    .from(embeddingRebuildRuns)
    .where(eq(embeddingRebuildRuns.id, id))
    .limit(1);
  if (!run) throw new Error(`Embedding rebuild run not found: ${id}`);
  return run;
}

async function countEmbeddingSourceArticles() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles);

  return Number(count ?? 0);
}

function getNextRebuildArticles(lastProcessedArticleId: number) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      summaryRaw: articles.summaryRaw,
      content: articles.content,
    })
    .from(articles)
    .where(gt(articles.id, lastProcessedArticleId))
    .orderBy(articles.id)
    .limit(REBUILD_ARTICLE_PAGE_SIZE);
}

async function updateEmbeddingRebuildRunProgress(
  runId: number,
  progress: EmbeddingRebuildProgress,
) {
  await db
    .update(embeddingRebuildRuns)
    .set({
      articleCount: progress.articleCount,
      chunkCount: progress.chunkCount,
      lastProcessedArticleId: progress.lastProcessedArticleId,
      lastProcessedAt: sql`now()`,
    })
    .where(eq(embeddingRebuildRuns.id, runId));
}

function buildArticleEmbeddingText(article: {
  title: string | null;
  summaryRaw: string | null;
  content: string | null;
}) {
  // summaryRaw 是 content 的前几句，拼入会造成第一个 chunk 语义重复；title 已通过 titlePrefix 注入每个 chunk
  return [article.content ?? article.summaryRaw].filter(Boolean).join("\n\n");
}

function assertSupportedVectorDimension(dimension: number) {
  if (!Number.isInteger(dimension) || dimension <= 0 || dimension > 16000) {
    throw new Error(`不支持的向量维度: ${dimension}`);
  }
}



export { chunkArticleText, expectedEmbeddingDimension };
