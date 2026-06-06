import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encodeArticleCursor, parseArticleCursor } from "@/lib/articles/cursor";
import { db } from "@/lib/db";
import {
  articleSummaries,
  articles,
  feeds,
  readStates,
} from "@/lib/db/schema";
import { toIsoString } from "@/lib/datetime";
import { sanitizeArticleHtml } from "@/lib/rss/sanitize";

const validArticleStatuses = ["unread", "read", "star", "later"] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "all";
  const feedId = numberParam(searchParams.get("feedId"));
  const articleId = numberParam(searchParams.get("articleId"));
  const search = searchParams.get("search")?.trim();
  const sort = parseArticleSort(searchParams.get("sort"));
  const limit = clamp(numberParam(searchParams.get("limit")) ?? 20, 1, 100);
  const queryLimit = articleId ? 1 : limit + 1;
  const cursor = parseArticleCursor(searchParams.get("cursor"));

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

  const sortAt = sql<string>`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`;
  const sortImportance = sql<number>`coalesce(${articleSummaries.importance}, 0)`;
  if (cursor && !articleId) {
    if (sort === "importance") {
      const cursorImportance = cursor.importance ?? 0;
      conditions.push(
        or(
          lt(sortImportance, cursorImportance),
          and(
            eq(sortImportance, cursorImportance),
            or(
              lt(sortAt, cursor.sortAt),
              and(eq(sortAt, cursor.sortAt), lt(articles.id, cursor.id)),
            ),
          ),
        ),
      );
    } else {
      conditions.push(
        or(
          lt(sortAt, cursor.sortAt),
          and(eq(sortAt, cursor.sortAt), lt(articles.id, cursor.id)),
        ),
      );
    }
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
      aiSummaryStatus: articleSummaries.status,
      aiSummaryError: articleSummaries.error,
      bullets: articleSummaries.bullets,
      tags: articleSummaries.tags,
      importance: articleSummaries.importance,
      sortAt,
      sortImportance,
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(readStates, eq(readStates.articleId, articles.id))
    .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
    .where(conditions.length ? sql.join(conditions, sql` and `) : undefined)
    .orderBy(...articleOrderBy(sort, sortImportance, sortAt))
    .limit(queryLimit);

  const pageRows = articleId ? rows : rows.slice(0, limit);
  const hasMore = !articleId && rows.length > limit;
  const lastRow = pageRows.at(-1);
  const lastSortAt = toIsoString(lastRow?.sortAt);
  const nextCursor =
    hasMore && lastRow && lastSortAt
      ? encodeArticleCursor({
          sortAt: lastSortAt,
          id: lastRow.id,
          ...(sort === "importance" ? { importance: lastRow.sortImportance } : {}),
        })
      : null;

  return NextResponse.json({
    articles: pageRows.map((row) => ({
      ...row,
      feedTitle: row.feedTitle ?? "未命名订阅源",
      publishedAt: toIsoString(row.publishedAt ?? row.fetchedAt),
      fetchedAt: toIsoString(row.fetchedAt),
      status: row.status ?? "unread",
      summary: row.aiSummary ?? "",
      summaryStatus: row.aiSummaryStatus ?? null,
      summaryError: row.aiSummaryError ?? null,
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
    if (body?.action === "mark-all-read") {
      return markAllRead(body);
    }

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

    if (!validArticleStatuses.includes(status)) {
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

async function markAllRead(body: unknown) {
  const { feedId, search } = body as {
    feedId?: number | null;
    search?: string | null;
  };
  const conditions = [
    sql`(${readStates.status} = 'unread' or ${readStates.id} is null)`,
  ];

  if (feedId != null) {
    if (!Number.isSafeInteger(feedId) || feedId <= 0) {
      return NextResponse.json(
        { message: "无效的 feedId 值" },
        { status: 400 },
      );
    }
    conditions.push(eq(articles.feedId, feedId));
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch}%`;
    const searchCondition = or(
      ilike(articles.title, pattern),
      ilike(articles.summaryRaw, pattern),
      ilike(articles.content, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  const whereClause = sql.join(conditions, sql` and `) ?? sql`true`;

  await db.execute(sql`
    insert into read_states (article_id, status)
    select ${articles.id}, 'read'
    from ${articles}
    left join ${readStates} on ${readStates.articleId} = ${articles.id}
    where ${whereClause}
    on conflict (article_id)
    do update set
      status = 'read',
      updated_at = now()
    where ${readStates.status} = 'unread'
  `);

  return NextResponse.json({ success: true, status: "read" });
}

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseArticleSort(value: string | null) {
  return value === "importance" ? "importance" : "latest";
}

function articleOrderBy(
  sort: "latest" | "importance",
  sortImportance: ReturnType<typeof sql<number>>,
  sortAt: ReturnType<typeof sql<string>>,
) {
  return sort === "importance"
    ? [desc(sortImportance), desc(sortAt), desc(articles.id)]
    : [desc(sortAt), desc(articles.id)];
}

function importanceLevel(value: number | null) {
  if (value == null) return "unknown";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}
