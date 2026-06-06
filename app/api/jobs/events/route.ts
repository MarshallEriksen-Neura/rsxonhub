import { auth } from "@/auth";
import { getQueueSnapshots } from "@/lib/jobs/queue-monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 1_000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

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
        const payload = {
          queues: await getQueueSnapshots(),
          updatedAt: new Date().toISOString(),
        };
        const serialized = JSON.stringify(payload);

        if (serialized !== lastPayload) {
          send("snapshot", payload);
          lastPayload = serialized;
        } else {
          send("heartbeat", { updatedAt: payload.updatedAt });
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
