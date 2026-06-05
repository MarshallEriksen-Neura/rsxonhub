import { db } from "@/lib/db";
import { appErrorLogs } from "@/lib/db/schema";
import { FeedFetchHttpError } from "@/lib/rss/fetch";

export const GENERIC_FEED_ERROR_MESSAGE =
  "订阅源暂时无法访问，请稍后重试。详细错误已记录。";

export async function logAppError(input: {
  source: string;
  operation: string;
  error: unknown;
  severity?: "info" | "warning" | "error";
  details?: Record<string, unknown>;
  feedId?: number;
  feedFetchRunId?: number;
}) {
  const normalized = normalizeError(input.error);

  try {
    const [row] = await db
      .insert(appErrorLogs)
      .values({
        source: input.source,
        operation: input.operation,
        severity: input.severity ?? "error",
        message: normalized.message,
        errorName: normalized.name,
        stack: normalized.stack,
        details: {
          ...upstreamDetails(input.error),
          ...(input.details ?? {}),
        },
        feedId: input.feedId,
        feedFetchRunId: input.feedFetchRunId,
      })
      .returning({ id: appErrorLogs.id });
    return row.id;
  } catch (logError) {
    console.error("Failed to write app_error_logs", logError);
    return null;
  }
}

export function publicFeedErrorResponse(error: string, status = 500) {
  return Response.json(
    {
      error,
      message: GENERIC_FEED_ERROR_MESSAGE,
    },
    { status },
  );
}

export function upstreamDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof FeedFetchHttpError)) return {};
  return {
    upstream: {
      statusCode: error.statusCode,
      url: error.url,
      contentType: error.contentType,
      responseBodyPreview: error.responseBodyPreview,
    },
  };
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: null,
    message: String(error),
    stack: null,
  };
}
