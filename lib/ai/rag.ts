import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { retrieveArticleChunks } from "@/lib/ai/embedding-rebuild";
import { buildRagSystemPrompt, type RagContext } from "@/lib/ai/prompts";

export type CitedArticle = {
  id: number;
  title: string | null;
  url: string | null;
};

export type RetrievedContext = {
  systemPrompt: string;
  citedArticles: CitedArticle[];
};

/**
 * 向量检索 → 关联文章元数据 → 构建 RAG system prompt。
 * route 层直接调用，不感知向量/SQL 细节。
 */
export async function retrieveContext(
  query: string,
  limit = 8,
): Promise<RetrievedContext> {
  const chunks = await retrieveArticleChunks(query, limit);

  if (chunks.length === 0) {
    return {
      systemPrompt: buildRagSystemPrompt({ chunks: [] }),
      citedArticles: [],
    };
  }

  // 去重文章 ID，批量查元数据
  const articleIds = [...new Set(chunks.map((c) => c.articleId))];
  const articleRows = await db
    .select({ id: articles.id, title: articles.title, url: articles.url })
    .from(articles)
    .where(
      articleIds.length === 1
        ? eq(articles.id, articleIds[0])
        : inArray(articles.id, articleIds),
    );

  const articleMap = new Map(articleRows.map((a) => [a.id, a]));

  const ctx: RagContext = {
    chunks: chunks.map((c) => {
      const meta = articleMap.get(c.articleId);
      return {
        content: c.content,
        articleTitle: meta?.title ?? null,
        articleUrl: meta?.url ?? null,
      };
    }),
  };

  return {
    systemPrompt: buildRagSystemPrompt(ctx),
    citedArticles: articleRows,
  };
}
