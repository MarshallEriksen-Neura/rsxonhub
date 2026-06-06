import {
  attachEmbeddingRebuildRunJob,
  createEmbeddingRebuildRun,
  markEmbeddingRebuildRunFailed,
  prepareEmbeddingDimensionRebuild,
  probeEmbeddingDimension,
} from "@/lib/ai/embedding-rebuild";
import { getChatConfig, getEmbeddingConfig, upsertAIConfigs } from "@/lib/ai/config";
import { enqueueArticleEmbedding } from "@/lib/jobs/feed-jobs";

export type StartEmbeddingRebuildResult = {
  rebuildRunId: number;
  probedDimension: number;
  message: string;
};

export async function startEmbeddingRebuildForCurrentModel(): Promise<StartEmbeddingRebuildResult> {
  const probedDimension = await probeEmbeddingDimension();
  await prepareEmbeddingDimensionRebuild(probedDimension);
  const [chatConfig, embeddingConfig] = await Promise.all([
    getChatConfig(),
    getEmbeddingConfig(),
  ]);
  await upsertAIConfigs(chatConfig, { ...embeddingConfig, dimension: probedDimension });
  const rebuildRunId = await createAndEnqueueEmbeddingRebuildRun();

  return {
    rebuildRunId,
    probedDimension,
    message: `向量索引已切换为 ${probedDimension} 维,重建任务 #${rebuildRunId} 已入队。`,
  };
}

export async function createAndEnqueueEmbeddingRebuildRun() {
  const run = await createEmbeddingRebuildRun();

  try {
    const jobId = await enqueueArticleEmbedding({ rebuildRunId: run.id });
    if (!jobId) {
      throw new Error("向量重建任务没有返回 jobId,可能被 pg-boss singleton 规则跳过。");
    }
    await attachEmbeddingRebuildRunJob(run.id, jobId);
    return run.id;
  } catch (error) {
    await markEmbeddingRebuildRunFailed(run.id, error);
    throw error;
  }
}
