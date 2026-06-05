import { embed, embedMany } from "ai";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { embeddingModel, nvidiaEmbedOptions, withAIRequestRetry } from "@/lib/ai";
import { getEmbeddingConfig } from "@/lib/ai/config";
import { chunkArticleText, expectedEmbeddingDimension } from "@/lib/ai/embedding-text";
import { db } from "@/lib/db";
import {
  articleChunks,
  articles,
  embeddingRebuildRuns,
  usageLogs,
} from "@/lib/db/schema";

const EMBED_BATCH_SIZE = 16;

export type EmbeddingChangeCheck = {
  changed: boolean;
  probedDimension: number;
  expectedDimension: number;
  existingChunkCount: number;
  requiresRebuild: boolean;
};

export async function probeEmbeddingDimension() {
  const model = await embeddingModel();
  const result = await withAIRequestRetry(() =>
    embed({
      model,
      value: "dimension probe",
      providerOptions: nvidiaEmbedOptions("query"),
    }),
  );

  return result.embedding.length;
}

export async function createEmbeddingRebuildRun() {
  const config = await getEmbeddingConfig();
  const [run] = await db
    .insert(embeddingRebuildRuns)
    .values({
      status: "pending",
      model: config.model,
      baseUrl: config.baseUrl,
      dimension: config.dimension,
    })
    .returning();

  return run;
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
  if (run) {
    await db
      .update(embeddingRebuildRuns)
      .set({ status: "running", startedAt: sql`coalesce(${embeddingRebuildRuns.startedAt}, now())`, error: null })
      .where(eq(embeddingRebuildRuns.id, run.id));
  }

  let articleCount = 0;
  let chunkCount = 0;

  try {
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        summaryRaw: articles.summaryRaw,
        content: articles.content,
      })
      .from(articles)
      .orderBy(articles.id);

    for (const article of rows) {
      const result = await embedArticle(article.id, buildArticleEmbeddingText(article), article.title ?? undefined);
      articleCount += 1;
      chunkCount += result.chunkCount;
    }

    if (run) {
      await db
        .update(embeddingRebuildRuns)
        .set({
          status: "complete",
          articleCount,
          chunkCount,
          finishedAt: sql`now()`,
          error: null,
        })
        .where(eq(embeddingRebuildRuns.id, run.id));
    }

    return { articleCount, chunkCount };
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
  const model = await embeddingModel();
  const result = await withAIRequestRetry(() =>
    embed({
      model,
      value: query,
      providerOptions: nvidiaEmbedOptions("query"),
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

  const model = await embeddingModel();
  let tokenCount = 0;

  for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
    const values = chunks.slice(start, start + EMBED_BATCH_SIZE);
    const result = await withAIRequestRetry(() =>
      embedMany({
        model,
        values,
        maxParallelCalls: 2,
        providerOptions: nvidiaEmbedOptions("passage"),
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

  const config = await getEmbeddingConfig();
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

function buildArticleEmbeddingText(article: {
  title: string | null;
  summaryRaw: string | null;
  content: string | null;
}) {
  // summaryRaw 是 content 的前几句，拼入会造成第一个 chunk 语义重复；title 已通过 titlePrefix 注入每个 chunk
  return [article.content ?? article.summaryRaw].filter(Boolean).join("\n\n");
}



export { chunkArticleText, expectedEmbeddingDimension };

