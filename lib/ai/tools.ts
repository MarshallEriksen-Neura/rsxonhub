import { tool, zodSchema } from "ai";
import { z } from "zod";
import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articles,
  articleSummaries,
  feeds,
  subscriptions,
  digests,
  digestItems,
} from "@/lib/db/schema";
import { retrieveArticleChunks } from "@/lib/ai/embedding-rebuild";
import type { CitedArticle } from "@/lib/ai/rag";

/**
 * 暴露给 LLM 的工具集。
 * 在 streamText({ tools }) 里使用；工具执行在服务端，结果注入回对话流。
 *
 * 设计原则：
 * - 每个工具只做一件事，返回精简数据（避免把全文塞入上下文）
 * - 需要全文时用 getArticleContent，其他工具只返回摘要/元数据
 */

const searchArticlesSchema = z.object({
  query: z.string().describe("检索关键词或问题"),
  limit: z.number().int().min(1).max(12).default(6).describe("返回条数"),
});

const findByKeywordSchema = z.object({
  keyword: z.string().describe("要搜索的关键词"),
  limit: z.number().int().min(1).max(20).default(10).describe("返回条数"),
});

const getArticleContentSchema = z.object({
  articleId: z.number().int().describe("文章 ID"),
});

type CreateChatToolsOptions = {
  onCitation?: (article: CitedArticle) => void;
};

function normalizeLimit(limit: number, max: number) {
  return Math.min(Math.max(limit, 1), max);
}

function cite(options: CreateChatToolsOptions, article: CitedArticle) {
  options.onCitation?.(article);
}

/** 语义检索：向量相似度召回文章 chunks，适合"找相关文章"类问题 */
export function createSearchArticlesTool(options: CreateChatToolsOptions = {}) {
  return tool({
  description:
    "按语义相似度检索订阅内容，返回最相关的文章片段及来源。适合回答「有没有关于 X 的文章」类问题。",
  inputSchema: zodSchema(searchArticlesSchema),
  execute: async ({ query, limit }) => {
    const normalizedQuery = query.trim();
    const safeLimit = normalizeLimit(limit, 12);

    if (!normalizedQuery) {
      return { results: [], warning: "搜索文本为空，未执行向量检索。" };
    }

    const chunks = await retrieveArticleChunks(normalizedQuery, safeLimit);
    if (chunks.length === 0) return { results: [] };

    const articleIds = [...new Set(chunks.map((c) => c.articleId))];
    const metas = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        feedTitle: feeds.title,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .innerJoin(feeds, eq(feeds.id, articles.feedId))
      .where(articleIds.length === 1 ? eq(articles.id, articleIds[0]) : inArray(articles.id, articleIds));

    const metaMap = new Map(metas.map((m) => [m.id, m]));

    const results = chunks.map((c) => {
      const meta = metaMap.get(c.articleId);
      if (meta) cite(options, { id: meta.id, title: meta.title, url: meta.url });
      return {
        articleId: c.articleId,
        title: meta?.title ?? null,
        url: meta?.url ?? null,
        feedTitle: meta?.feedTitle ?? null,
        publishedAt: meta?.publishedAt?.toISOString() ?? null,
        excerpt: (c.body ?? c.content).slice(0, 1200),
        chunkIndex: c.chunkIndex,
        chunkType: c.chunkType,
        sectionPath: c.sectionPath ?? [],
        charStart: c.charStart,
        charEnd: c.charEnd,
        distance: c.distance,
        lexicalScore: c.lexicalScore,
        vectorRank: c.vectorRank,
        lexicalRank: c.lexicalRank,
        fusedScore: c.fusedScore,
        retrievalSource: c.retrievalSource,
      };
    });

    return {
      results,
    };
  },
});
}

/** 关键词检索：按标题/摘要全文搜索，适合精确词搜索 */
export function createFindArticlesByKeywordTool(options: CreateChatToolsOptions = {}) {
  return tool({
  description:
    "按关键词搜索文章标题和摘要，返回最近匹配的文章列表（不做语义理解，适合搜索具体词语）。",
  inputSchema: zodSchema(findByKeywordSchema),
  execute: async ({ keyword, limit }) => {
    const normalizedKeyword = keyword.trim();
    const safeLimit = normalizeLimit(limit, 20);

    if (!normalizedKeyword) {
      return { articles: [], warning: "关键词为空，未执行数据库搜索。" };
    }

    const pattern = `%${normalizedKeyword}%`;
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        feedTitle: feeds.title,
        publishedAt: articles.publishedAt,
        summary: articleSummaries.summary,
        importance: articleSummaries.importance,
        tags: articleSummaries.tags,
      })
      .from(articles)
      .innerJoin(feeds, eq(feeds.id, articles.feedId))
      .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
      .where(or(ilike(articles.title, pattern), ilike(articleSummaries.summary, pattern)))
      .orderBy(desc(articles.publishedAt))
      .limit(safeLimit);

    for (const row of rows) {
      cite(options, { id: row.id, title: row.title, url: row.url });
    }

    return {
      articles: rows.map((r) => ({
        ...r,
        summary: r.summary ? r.summary.slice(0, 1200) : null,
        publishedAt: r.publishedAt?.toISOString() ?? null,
      })),
    };
  },
});
}

/** 获取文章全文：仅在需要深读时调用 */
export function createGetArticleContentTool(options: CreateChatToolsOptions = {}) {
  return tool({
  description:
    "获取指定文章的完整正文。只在需要引用或分析具体内容时调用，一次最多取 1 篇。",
  inputSchema: zodSchema(getArticleContentSchema),
  execute: async ({ articleId }) => {
    const [row] = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        content: articles.content,
        publishedAt: articles.publishedAt,
        feedTitle: feeds.title,
        summary: articleSummaries.summary,
        bullets: articleSummaries.bullets,
        tags: articleSummaries.tags,
      })
      .from(articles)
      .innerJoin(feeds, eq(feeds.id, articles.feedId))
      .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!row) return { error: `文章 ${articleId} 不存在` };
    cite(options, { id: row.id, title: row.title, url: row.url });

    return {
      ...row,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      content: row.content ? row.content.slice(0, 6000) : null,
    };
  },
});
}

/** 列出订阅源 */
export function createListFeedsTool() {
  return tool({
  description: "列出所有订阅源，用于回答「我订阅了哪些」类问题。",
  inputSchema: zodSchema(z.object({})),
  execute: async () => {
    const rows = await db
      .select({
        id: feeds.id,
        title: feeds.title,
        url: feeds.url,
        folder: subscriptions.folder,
      })
      .from(feeds)
      .leftJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
      .orderBy(subscriptions.folder, feeds.title);
    return { feeds: rows };
  },
});
}

/** 取最近一份 digest */
export function createGetLatestDigestTool(options: CreateChatToolsOptions = {}) {
  return tool({
  description: "获取最新一份每日精选摘要（digest），用于回答「今天有什么重要内容」类问题。",
  inputSchema: zodSchema(z.object({})),
  execute: async () => {
    const [digest] = await db
      .select()
      .from(digests)
      .orderBy(desc(digests.digestDate))
      .limit(1);

    if (!digest) return { digest: null };

    const items = await db
      .select({
        articleId: digestItems.articleId,
        reason: digestItems.reason,
        articleTitle: articles.title,
        articleUrl: articles.url,
      })
      .from(digestItems)
      .innerJoin(articles, eq(articles.id, digestItems.articleId))
      .where(eq(digestItems.digestId, digest.id))
      .orderBy(digestItems.position);
    for (const item of items) {
      cite(options, {
        id: item.articleId,
        title: item.articleTitle,
        url: item.articleUrl,
      });
    }

    return {
      digest: { date: digest.digestDate, title: digest.title, summary: digest.summary, items },
    };
  },
});
}

/** 全部工具集合，传给 streamText({ tools }) */
export function createChatTools(options: CreateChatToolsOptions = {}) {
  return {
    searchArticles: createSearchArticlesTool(options),
    findArticlesByKeyword: createFindArticlesByKeywordTool(options),
    getArticleContent: createGetArticleContentTool(options),
    listFeeds: createListFeedsTool(),
    getLatestDigest: createGetLatestDigestTool(options),
  } as const;
}

export const chatTools = {
  searchArticles: createSearchArticlesTool(),
  findArticlesByKeyword: createFindArticlesByKeywordTool(),
  getArticleContent: createGetArticleContentTool(),
  listFeeds: createListFeedsTool(),
  getLatestDigest: createGetLatestDigestTool(),
} as const;
