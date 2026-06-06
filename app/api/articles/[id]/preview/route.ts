import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { articles, articleSummaries, feeds } from "@/lib/db/schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      feedTitle: feeds.title,
      summary: articleSummaries.summary,
      bullets: articleSummaries.bullets,
      tags: articleSummaries.tags,
      importance: articleSummaries.importance,
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
    .where(eq(articles.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    ...row,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  });
}
