import { desc, eq, ilike, or, sql } from "drizzle-orm";
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
  const limit = clamp(numberParam(searchParams.get("limit")) ?? 80, 1, 200);

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
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(readStates, eq(readStates.articleId, articles.id))
    .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
    .where(conditions.length ? sql.join(conditions, sql` and `) : undefined)
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
    .limit(articleId ? 1 : limit);

  return NextResponse.json({
    articles: rows.map((row) => ({
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
  });
}

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function importanceLevel(value: number | null) {
  if (value == null) return "low";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}
