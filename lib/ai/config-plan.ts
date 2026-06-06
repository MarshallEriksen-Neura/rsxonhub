import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";

export type ChatApiMode = "chat_completions" | "responses";

export type ChatConfigPlanInput = {
  kind: "chat";
  baseUrl: string;
  apiKey: string;
  model: string;
  chatApiMode: ChatApiMode;
  temperature: number;
};

export type EmbeddingConfigPlanInput = {
  kind: "embedding";
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
};

export type ParsedAIConfigPlanInput = {
  chat: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    chatApiMode?: ChatApiMode;
    temperature: number;
  };
  embedding: {
    baseUrl: string;
    apiKey?: string;
    model: string;
  };
};

export function buildNextAIConfigPlan(
  parsed: ParsedAIConfigPlanInput,
  existingChat: ChatConfigPlanInput,
  existingEmbedding: EmbeddingConfigPlanInput,
) {
  const chat: ChatConfigPlanInput = {
    kind: "chat",
    baseUrl: parsed.chat.baseUrl,
    apiKey: nextApiKey(parsed.chat.apiKey, existingChat.apiKey),
    model: parsed.chat.model,
    chatApiMode: parsed.chat.chatApiMode ?? existingChat.chatApiMode,
    temperature: parsed.chat.temperature,
  };

  const embedding: EmbeddingConfigPlanInput = {
    kind: "embedding",
    baseUrl: parsed.embedding.baseUrl,
    apiKey: nextApiKey(parsed.embedding.apiKey, existingEmbedding.apiKey),
    model: parsed.embedding.model,
    dimension: DEFAULT_EMBEDDING_DIM,
  };

  return { chat, embedding };
}

export function embeddingConfigPlanChanged(
  previous: EmbeddingConfigPlanInput,
  next: EmbeddingConfigPlanInput,
) {
  return previous.baseUrl !== next.baseUrl || previous.model !== next.model;
}

function nextApiKey(next: string | undefined, previous: string) {
  const trimmed = next?.trim();
  return trimmed || previous;
}
