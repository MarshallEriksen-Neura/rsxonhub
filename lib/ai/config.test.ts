import { describe, expect, test } from "bun:test";
import {
  buildNextAIConfigPlan,
  embeddingConfigPlanChanged,
  type ChatConfigPlanInput,
  type EmbeddingConfigPlanInput,
} from "@/lib/ai/config-plan";

describe("AI config save planning", () => {
  const chat: ChatConfigPlanInput = {
    kind: "chat",
    baseUrl: "https://old-chat.example/v1",
    apiKey: "old-chat-key",
    model: "old-chat",
    chatApiMode: "responses",
    temperature: 0.5,
  };
  const embedding: EmbeddingConfigPlanInput = {
    kind: "embedding",
    baseUrl: "https://old-embedding.example/v1",
    apiKey: "old-embedding-key",
    model: "old-embedding",
    dimension: 2048,
  };

  test("detects embedding model/base changes only", () => {
    expect(embeddingConfigPlanChanged(embedding, { ...embedding })).toBe(false);
    expect(embeddingConfigPlanChanged(embedding, { ...embedding, model: "new-embedding" })).toBe(true);
    expect(embeddingConfigPlanChanged(embedding, { ...embedding, baseUrl: "https://new.example/v1" })).toBe(true);
  });

  test("preserves previous api keys when save input leaves keys blank", () => {
    const parsed = {
      chat: {
        baseUrl: "https://chat.example/v1",
        apiKey: "",
        model: "chat-model",
        temperature: 0.7,
      },
      embedding: {
        baseUrl: "https://embedding.example/v1",
        apiKey: "",
        model: "embedding-model",
      },
    };

    const next = buildNextAIConfigPlan(parsed, chat, embedding);
    expect(next.chat.apiKey).toBe("old-chat-key");
    expect(next.chat.chatApiMode).toBe("responses");
    expect(next.embedding.apiKey).toBe("old-embedding-key");
  });

  test("applies explicit chat API mode changes", () => {
    const next = buildNextAIConfigPlan(
      {
        chat: {
          baseUrl: "https://chat.example/v1",
          apiKey: "",
          model: "chat-model",
          chatApiMode: "chat_completions",
          temperature: 0.7,
        },
        embedding: {
          baseUrl: "https://embedding.example/v1",
          apiKey: "",
          model: "embedding-model",
        },
      },
      chat,
      embedding,
    );

    expect(next.chat.chatApiMode).toBe("chat_completions");
  });
});



