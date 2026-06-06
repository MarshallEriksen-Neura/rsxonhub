import { NextResponse } from "next/server";
import { getEmbeddingRebuildRun } from "@/lib/ai/embedding-rebuild";
import { serializeEmbeddingRebuildRun } from "@/lib/ai/embedding-rebuild-events";
import { startEmbeddingRebuildForCurrentModel } from "@/lib/ai/embedding-rebuild-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await startEmbeddingRebuildForCurrentModel();
    const run = await getEmbeddingRebuildRun(result.rebuildRunId);

    return NextResponse.json({
      ok: true,
      rebuildRunId: result.rebuildRunId,
      message: result.message,
      progress: run ? serializeEmbeddingRebuildRun(run) : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "重建向量索引失败。",
      },
      { status: 500 },
    );
  }
}
