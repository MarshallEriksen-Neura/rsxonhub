export type EmbeddingRebuildPlanInput = {
  embeddingChanged: boolean;
  existingChunkCount: number;
  probedDimension: number;
  expectedDimension: number;
  confirmed: boolean;
};

export type EmbeddingRebuildPlan =
  | { action: "none" }
  | {
      action: "confirm";
      message: string;
      existingChunkCount: number;
      probedDimension: number;
      expectedDimension: number;
    }
  | { action: "rebuild"; resizeDimension: number | null };

export function planEmbeddingRebuild(
  input: EmbeddingRebuildPlanInput,
): EmbeddingRebuildPlan {
  if (!input.embeddingChanged) {
    return { action: "none" };
  }

  const dimensionChanged = input.probedDimension !== input.expectedDimension;
  const requiresConfirmation = input.existingChunkCount > 0 || dimensionChanged;

  if (requiresConfirmation && !input.confirmed) {
    return {
      action: "confirm",
      message: dimensionChanged
        ? "新向量模型维度与当前数据库向量列不同。确认后会更新向量列维度、清除旧向量,并在后台重建文章向量。"
        : "向量模型或 Base URL 已变化,现有文章向量需要后台重建。确认后保存会立即返回,重建在 worker 中静默执行。",
      existingChunkCount: input.existingChunkCount,
      probedDimension: input.probedDimension,
      expectedDimension: input.expectedDimension,
    };
  }

  return {
    action: "rebuild",
    resizeDimension: dimensionChanged ? input.probedDimension : null,
  };
}
