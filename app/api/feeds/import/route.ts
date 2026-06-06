import { NextResponse } from "next/server";
import { z } from "zod";
import { logAppError, publicFeedErrorResponse } from "@/lib/errors/app-error-log";
import { enqueueChangedArticleEmbeddings } from "@/lib/jobs/feed-jobs";
import { fetchFoloListSubscriptions, FoloListError } from "@/lib/rss/folo-list";
import { ingestFeed, subscribeFeed } from "@/lib/rss/ingest";
import { parseOpmlSubscriptions } from "@/lib/rss/opml";

const MAX_IMPORT_SUBSCRIPTIONS = 100;

const importFeedsSchema = z
  .object({
    opml: z.string().trim().min(1).max(1_000_000).optional(),
    foloListUrl: z.string().trim().min(1).optional(),
    folder: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.opml) !== Boolean(value.foloListUrl), {
    message: "请提供 OPML 内容或 Folo 分享列表链接。",
    path: ["opml"],
  });

export async function POST(request: Request) {
  const parsed = importFeedsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let subscriptions;
  try {
    subscriptions = parsed.data.foloListUrl
      ? await fetchFoloListSubscriptions(parsed.data.foloListUrl, {
          fallbackFolder: parsed.data.folder,
          limit: MAX_IMPORT_SUBSCRIPTIONS,
        })
      : parseOpmlSubscriptions(parsed.data.opml ?? "", parsed.data.folder);
  } catch (error) {
    if (error instanceof FoloListError) {
      return NextResponse.json(
        { error: "INVALID_FOLO_LIST", message: error.message },
        { status: 400 },
      );
    }
    throw error;
  }

  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "EMPTY_IMPORT", message: "没有找到可导入的订阅源。" },
      { status: 400 },
    );
  }

  const results = [];
  for (const subscription of subscriptions.slice(0, MAX_IMPORT_SUBSCRIPTIONS)) {
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
