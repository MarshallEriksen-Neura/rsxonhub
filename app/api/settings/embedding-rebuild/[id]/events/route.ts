import { getEmbeddingRebuildRun } from "@/lib/ai/embedding-rebuild";
import { serializeEmbeddingRebuildRun } from "@/lib/ai/embedding-rebuild-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 1_000;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const runId = parseRunId((await params).id);
  if (!runId) {
    return Response.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload: string | null = null;

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      while (!request.signal.aborted) {
        const run = await getEmbeddingRebuildRun(runId);
        if (!run) {
          send("unavailable", { error: "NOT_FOUND" });
          break;
        }

        const progress = serializeEmbeddingRebuildRun(run);
        const payload = JSON.stringify(progress);
        if (payload !== lastPayload) {
          send("progress", progress);
          lastPayload = payload;
        }

        if (progress.terminal) {
          send("done", progress);
          break;
        }

        await sleepUntilNextPoll(request.signal);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function parseRunId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sleepUntilNextPoll(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, POLL_INTERVAL_MS);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
