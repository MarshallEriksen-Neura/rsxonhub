import { createOpenAI } from "@ai-sdk/openai";
import {
  getChatConfig,
  getEmbeddingConfig,
  type EmbeddingRuntimeConfig,
} from "@/lib/ai/config";
import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";
import { createAIRequestFetch } from "@/lib/ai/proxy-fetch";
import {
  type AIRetryOptions,
  withExponentialBackoff,
} from "@/lib/ai/retry";
export { aiProxyUrl, aiRequestFetch, createAIRequestFetch } from "@/lib/ai/proxy-fetch";

/**
 * AI provider 工厂。业务代码只认这里,不直接 import provider SDK。
 * Chat 与 embedding 分两套 DB 配置,均为 OpenAI 兼容接口。
 */

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export const EMBEDDING_DIM = DEFAULT_EMBEDDING_DIM;

export async function chatModel() {
  const config = await getChatConfig();
  assertConfiguredApiKey("对话模型", config.apiKey);

  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    fetch: createAIRequestFetch({
      nvidiaChatTemplateKwargs: {
        thinking: true,
        reasoning_effort: "high",
      },
    }),
  });

  return config.chatApiMode === "responses"
    ? provider.responses(config.model)
    : provider.chat(config.model);
}

export async function embeddingModel(inputType: "passage" | "query" = "query") {
  const { model } = await embeddingModelWithConfig(inputType);
  return model;
}

export async function embeddingModelWithConfig(
  inputType: "passage" | "query" = "query",
  configOverride?: EmbeddingRuntimeConfig,
) {
  const config = configOverride ?? await getEmbeddingConfig();
  assertConfiguredApiKey("向量模型", config.apiKey);

  const model = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    fetch: createAIRequestFetch({ nvidiaEmbeddingInputType: inputType }),
  }).embedding(config.model);

  return { config, model };
}

export function withAIRequestRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: AIRetryOptions,
) {
  return withExponentialBackoff(operation, options);
}

function assertConfiguredApiKey(label: string, apiKey: string) {
  if (!apiKey.trim()) {
    throw new AIConfigurationError(`${label} API Key 未配置,请先在设置页保存 AI 配置。`);
  }
}
