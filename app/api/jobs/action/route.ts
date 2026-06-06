import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getQueueSnapshots, runQueueAction } from "@/lib/jobs/queue-monitor";

export const runtime = "nodejs";

const queueActionSchema = z.object({
  queueName: z.string().min(1),
  action: z.enum(["cancel-waiting", "retry-failed", "delete-completed"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const parsed = queueActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await runQueueAction(parsed.data.queueName, parsed.data.action);
    return NextResponse.json({
      ok: true,
      ...result,
      queues: await getQueueSnapshots(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message, message: "队列操作失败。" },
      { status: message === "UNKNOWN_QUEUE" || message === "UNKNOWN_ACTION" ? 400 : 500 },
    );
  }
}
