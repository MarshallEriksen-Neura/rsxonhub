import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { analyzeArticle } from "@/lib/ai/article-analysis";
import { db } from "@/lib/db";
import { articleSummaries } from "@/lib/db/schema";
import { logAppError } from "@/lib/errors/app-error-log";

const summarizeArticleSchema = z.object({
  articleId: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  const parsed = summarizeArticleSchema.safeParse(
    await request.json().catch(() => ({})),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { articleId } = parsed.data;

  try {
    const analysis = await analyzeArticle(articleId);
    const summary = analysis.skipped
      ? await getPersistedSummary(articleId)
      : analysis.result;

    return NextResponse.json({
      articleId,
      skipped: analysis.skipped,
      reason: analysis.skipped ? analysis.reason : null,
      summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message === `Article not found: ${articleId}`) {
      return NextResponse.json(
        { error: "ARTICLE_NOT_FOUND", message: "文章不存在" },
        { status: 404 },
      );
    }

    // AI 未配置（apiKey 为空时 SDK 抛出认证错误）
    const msg = error instanceof Error ? error.message : String(error);
    if (/api.?key|unauthorized|authentication|401/i.test(msg)) {
      return NextResponse.json(
        { error: "AI_NOT_CONFIGURED", message: "AI 未配置，请前往设置填写 API Key。" },
        { status: 503 },
      );
    }

    await logAppError({
      source: "api",
      operation: "articles.summary.POST",
      error,
      details: { articleId },
    });

    return NextResponse.json(
      { error: "SUMMARY_FAILED", message: msg },
      { status: 500 },
    );
  }
}

async function getPersistedSummary(articleId: number) {
  const [summary] = await db
    .select({
      summary: articleSummaries.summary,
      bullets: articleSummaries.bullets,
      tags: articleSummaries.tags,
      importance: articleSummaries.importance,
    })
    .from(articleSummaries)
    .where(eq(articleSummaries.articleId, articleId))
    .limit(1);

  return summary
    ? {
        summary: summary.summary ?? "",
        bullets: summary.bullets ?? [],
        tags: summary.tags ?? [],
        importance: summary.importance ?? 0,
      }
    : null;
}
