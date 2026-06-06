import { NextResponse } from "next/server";
import { z } from "zod";
import { logAppError, publicFeedErrorResponse } from "@/lib/errors/app-error-log";
import { enqueueChangedArticleEmbeddings } from "@/lib/jobs/feed-jobs";
import { ingestFeed, subscribeFeed } from "@/lib/rss/ingest";
import { parseOpmlSubscriptions } from "@/lib/rss/opml";

const importFeedsSchema = z.object({
  opml: z.string().trim().min(1).max(1_000_000),
  folder: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  const parsed = importFeedsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const subscriptions = parseOpmlSubscriptions(parsed.data.opml, parsed.data.folder);
  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "EMPTY_OPML", message: "没有在 OPML 中找到可导入的订阅源。" },
      { status: 400 },
    );
  }

  const results = [];
  for (const subscription of subscriptions.slice(0, 100)) {
    try {
      const feed = await subscribeFeed({
        sourceUri: subscription.sourceUri,
        title: subscription.title ?? undefined,
        folder: subscription.folder ?? parsed.data.folder,
      });
      const ingest = await ingestFeed(feed.id);
      const embeddingIndex = await enqueueChangedArticleEmbeddings(ingest);

      results.push({
        ok: true,
        sourceUri: subscription.sourceUri,
        feedId: feed.id,
        title: feed.title,
        folder: subscription.folder ?? parsed.data.folder ?? null,
        ingest,
        embeddingIndex,
      });
    } catch (error) {
      await logAppError({
        source: "api",
        operation: "feeds.import.POST.item",
        error,
        details: {
          sourceUri: subscription.sourceUri,
          title: subscription.title,
          folder: subscription.folder ?? parsed.data.folder,
        },
      });

      results.push({
        ok: false,
        sourceUri: subscription.sourceUri,
        title: subscription.title,
        folder: subscription.folder ?? parsed.data.folder ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const importedCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - importedCount;

  try {
    return NextResponse.json({
      totalCount: subscriptions.length,
      processedCount: results.length,
      importedCount,
      failedCount,
      truncated: subscriptions.length > results.length,
      results,
    });
  } catch (error) {
    await logAppError({
      source: "api",
      operation: "feeds.import.POST",
      error,
      details: { subscriptionCount: subscriptions.length },
    });
    return publicFeedErrorResponse("IMPORT_FEEDS_FAILED", 500);
  }
}
