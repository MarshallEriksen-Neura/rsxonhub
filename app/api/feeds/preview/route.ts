import { NextResponse } from "next/server";
import { z } from "zod";
import { parseFeedUrl } from "@/lib/rss/parser";
import { normalizeFeed } from "@/lib/rss/normalize";
import { resolveFeedSource, SourceUriError } from "@/lib/rsshub/source-uri";

const previewSchema = z.object({
  sourceUri: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const source = resolveFeedSource(parsed.data.sourceUri);
    const feed = await parseFeedUrl(source.fetchUrl);
    const normalized = normalizeFeed(feed, source);

    return NextResponse.json({
      source: {
        type: source.type,
        canonicalUri: source.canonicalUri,
        fetchUrl: source.fetchUrl,
        ...(source.type === "rsshub" ? { route: source.route } : {}),
      },
      feed: {
        title: normalized.title,
        siteUrl: normalized.siteUrl,
        itemCount: feed.items?.length ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof SourceUriError) {
      return NextResponse.json(
        { error: "INVALID_SOURCE_URI", message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "PREVIEW_FEED_FAILED",
        message: error instanceof Error ? error.message : "预览订阅源失败",
      },
      { status: 502 },
    );
  }
}
