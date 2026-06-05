import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  articleSummaries,
  articles,
  feeds,
  readStates,
} from "@/lib/db/schema";
import { sanitizeArticleHtml } from "@/lib/rss/sanitize";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "all";
  const feedId = numberParam(searchParams.get("feedId"));
  const articleId = numberParam(searchParams.get("articleId"));
  const search = searchParams.get("search")?.trim();
  const limit = clamp(numberParam(searchParams.get("limit")) ?? 20, 1, 100);
  const queryLimit = articleId ? 1 : limit + 1;
  const cursor = parseCursor(searchParams.get("cursor"));

  const conditions = [];

  if (articleId) {
    conditions.push(eq(articles.id, articleId));
  }

  if (feedId) {
    conditions.push(eq(articles.feedId, feedId));
  }

  if (view === "unread") {
    conditions.push(eq(readStates.status, "unread"));
  } else if (view === "star") {
    conditions.push(eq(readStates.status, "star"));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(articles.title, pattern),
        ilike(articles.summaryRaw, pattern),
        ilike(articles.content, pattern),
      ),
    );
  }

  const sortAt = sql<Date>`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`;
  if (cursor && !articleId) {
    conditions.push(
      or(
        lt(sortAt, new Date(cursor.sortAt)),
        and(eq(sortAt, new Date(cursor.sortAt)), lt(articles.id, cursor.id)),
      ),
    );
  }

  const rows = await db
    .select({
      id: articles.id,
      feedId: articles.feedId,
      feedTitle: feeds.title,
      title: articles.title,
      url: articles.url,
      author: articles.author,
      publishedAt: articles.publishedAt,
      fetchedAt: articles.fetchedAt,
      imageUrl: articles.imageUrl,
      summaryRaw: articles.summaryRaw,
      content: articles.content,
      status: readStates.status,
      aiSummary: articleSummaries.summary,
      bullets: articleSummaries.bullets,
      tags: articleSummaries.tags,
      importance: articleSummaries.importance,
      sortAt,
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(readStates, eq(readStates.articleId, articles.id))
    .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
    .where(conditions.length ? sql.join(conditions, sql` and `) : undefined)
    .orderBy(desc(sortAt), desc(articles.id))
    .limit(queryLimit);

  const pageRows = articleId ? rows : rows.slice(0, limit);
  const hasMore = !articleId && rows.length > limit;
  const lastRow = pageRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({ sortAt: lastRow.sortAt.toISOString(), id: lastRow.id })
      : null;

  return NextResponse.json({
    articles: pageRows.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? "未命名订阅源",
      publishedAt: (row.publishedAt ?? row.fetchedAt)?.toISOString() ?? null,
      fetchedAt: row.fetchedAt.toISOString(),
      status: row.status ?? "unread",
      summary: row.aiSummary ?? row.summaryRaw ?? "",
      bullets: row.bullets ?? [],
      tags: row.tags ?? [],
      importance: importanceLevel(row.importance),
      // 正文渲染走 dangerouslySetInnerHTML:存量 content 已在 ingest 净化;
      // summaryRaw 回退路径未净化,这里补一次净化,杜绝 XSS。
      content: row.content ?? sanitizeArticleHtml(row.summaryRaw) ?? "",
    })),
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  });
}

/**
 * 更新文章阅读状态。
 * Body: { articleId: number, status: "unread" | "read" | "star" | "later" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { articleId, status } = body as {
      articleId: number;
      status: "unread" | "read" | "star" | "later";
    };

    if (!articleId || !status) {
      return NextResponse.json(
        { message: "缺少必要参数: articleId, status" },
        { status: 400 },
      );
    }

    const validStatuses = ["unread", "read", "star", "later"] as const;
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { message: "无效的 status 值" },
        { status: 400 },
      );
    }

    // 使用 upsert:存在则更新,不存在则插入
    await db
      .insert(readStates)
      .values({ articleId, status })
      .onConflictDoUpdate({
        target: [readStates.articleId],
        set: { status, updatedAt: sql`now()` },
      });

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("更新阅读状态失败:", error);
    return NextResponse.json(
      { message: "更新阅读状态失败" },
      { status: 500 },
    );
  }
}

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function encodeCursor(value: ArticleCursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseCursor(value: string | null): ArticleCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed?.sortAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.sortAt)) ||
      !Number.isInteger(parsed?.id)
    ) {
      return null;
    }
    return { sortAt: parsed.sortAt, id: parsed.id };
  } catch {
    return null;
  }
}

type ArticleCursor = {
  sortAt: string;
  id: number;
};

function importanceLevel(value: number | null) {
  if (value == null) return "low";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}
