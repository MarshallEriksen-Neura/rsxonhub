import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

/**
 * AI provider 工厂。业务代码只认这里,不直接 import provider SDK。
 * 见 docs/product-design.md §6。chat 与 embedding 分两套配置。
 */

// Chat / 摘要 / Digest / 问答生成
const chatProvider = createOpenAI({
  baseURL: env.OPENAI_BASE_URL,
  apiKey: env.OPENAI_API_KEY ?? "",
});

export function chatModel() {
  if (!env.CHAT_MODEL) {
    throw new Error("CHAT_MODEL 未配置(见 .env.local)");
  }
  return chatProvider(env.CHAT_MODEL);
}

// Embedding(NVIDIA,OpenAI 兼容)
const embeddingProvider = createOpenAI({
  baseURL: env.EMBEDDING_BASE_URL,
  apiKey: env.EMBEDDING_API_KEY ?? "",
});

export const embeddingRawModel = embeddingProvider.embedding(
  env.EMBEDDING_MODEL,
);

export const EMBEDDING_DIM = env.EMBEDDING_DIM;

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
