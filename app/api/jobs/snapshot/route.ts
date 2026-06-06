import { auth } from "@/auth";
import { getQueueSnapshots } from "@/lib/jobs/queue-monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  return Response.json({
    queues: await getQueueSnapshots(),
    updatedAt: new Date().toISOString(),
  });
}
