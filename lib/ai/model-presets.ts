import type { AIConfigKind } from "@/lib/ai/config";

export type AIModelCapability = {
  model: string;
  supportsChat: boolean;
  supportsEmbedding: boolean;
};

export type AIModelPresetSnapshot = {
  chat: AIModelCapability[];
  embedding: AIModelCapability[];
};

export type ChatModelSelectionSnapshot = {
  defaultModel: string;
  models: string[];
};

type ModelMetadata = Record<string, unknown>;

const EMBEDDING_PATTERNS = [
  "embedding",
  "embed",
  "embeddings",
  "rerank",
  "reranker",
  "text-embedding",
  "bge",
  "e5",
  "gte",
  "nomic-embed",
  "nv-embed",
  "embedqa",
  "arctic-embed",
  "jina-embeddings",
];

const CHAT_PATTERNS = [
  "chat",
  "instruct",
  "assistant",
  "llm",
  "gpt",
  "o1",
  "o3",
  "o4",
  "claude",
  "deepseek",
  "llama",
  "mistral",
  "mixtral",
  "codestral",
  "qwen",
  "gemma",
  "phi",
  "nemotron",
  "command",
  "kimi",
  "minimax",
  "glm",
  "yi-",
  "multimodal",
];

export function inferModelCapabilities(
  model: string,
  metadata: ModelMetadata | undefined,
  fallbackKind: AIConfigKind,
): Omit<AIModelCapability, "model"> {
  const haystack = searchableModelText(model, metadata);
  const supportsEmbedding = EMBEDDING_PATTERNS.some((pattern) =>
    haystack.includes(pattern),
  );
  const supportsChat =
    !supportsEmbedding &&
    CHAT_PATTERNS.some((pattern) => haystack.includes(pattern));

  if (!supportsChat && !supportsEmbedding) {
    return {
      supportsChat: fallbackKind === "chat",
      supportsEmbedding: fallbackKind === "embedding",
    };
  }

  return {
    supportsChat,
    supportsEmbedding,
  };
}

export function buildChatModelSelectionSnapshot(
  defaultModel: string,
  presets: AIModelCapability[],
): ChatModelSelectionSnapshot {
  const normalizedDefault = defaultModel.trim();
  const availableModels = presets
    .filter((preset) => preset.supportsChat)
    .map((preset) => preset.model.trim())
    .filter(Boolean)
    .filter((model) => model !== normalizedDefault)
    .sort((a, b) => a.localeCompare(b));

  return {
    defaultModel: normalizedDefault,
    models: [normalizedDefault, ...new Set(availableModels)],
  };
}

export function resolveChatModelSelection(
  requestedModel: string | null | undefined,
  snapshot: ChatModelSelectionSnapshot,
) {
  const normalized = requestedModel?.trim();
  if (!normalized) return snapshot.defaultModel;
  if (snapshot.models.includes(normalized)) return normalized;

  throw new Error(`INVALID_CHAT_MODEL: ${normalized}`);
}

function searchableModelText(model: string, metadata: ModelMetadata | undefined) {
  return [model, ...collectStringValues(metadata)].join(" ").toLowerCase();
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStringValues);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectStringValues);
  }

  return [];
}
