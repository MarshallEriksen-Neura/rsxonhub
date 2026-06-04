import { createOpenAI } from "@ai-sdk/openai";
import { getChatConfig, getEmbeddingConfig } from "@/lib/ai/config";
import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";
import {
  type AIRetryOptions,
  withExponentialBackoff,
} from "@/lib/ai/retry";

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

  return createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  })(config.model);
}

export async function embeddingModel() {
  const config = await getEmbeddingConfig();
  assertConfiguredApiKey("向量模型", config.apiKey);

  return createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  }).embedding(config.model);
}

export function withAIRequestRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: AIRetryOptions,
) {
  return withExponentialBackoff(operation, options);
}

/**
 * NVIDIA embedding 的 input_type 坑(见 §6 坑 2):入库 chunk 用 "passage",
 * 检索提问用 "query"。通过调用时的 providerOptions 透传到请求体,
 * 标准 OpenAI body 没有这个字段。封装在此,避免业务层漏传。
 */
export function nvidiaEmbedOptions(inputType: "passage" | "query") {
  return {
    openai: {
      input_type: inputType,
      truncate: "NONE",
    },
  } as const;
}

function assertConfiguredApiKey(label: string, apiKey: string) {
  if (!apiKey.trim()) {
    throw new AIConfigurationError(`${label} API Key 未配置,请先在设置页保存 AI 配置。`);
  }
}
