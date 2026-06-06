import { describe, expect, test } from "bun:test";
import { inferModelCapabilities } from "@/lib/ai/model-presets";

describe("AI model preset capability inference", () => {
  test("classifies embedding model names before chat-like provider families", () => {
    expect(
      inferModelCapabilities("nvidia/llama-nemotron-embed-1b-v2", undefined, "chat"),
    ).toEqual({
      supportsChat: false,
      supportsEmbedding: true,
    });
  });

  test("classifies reranker model names as retrieval models before qwen chat family", () => {
    expect(inferModelCapabilities("Qwen3-Reranker-4B", undefined, "chat")).toEqual({
      supportsChat: false,
      supportsEmbedding: true,
    });

    expect(inferModelCapabilities("Qwen3-VL-Reranker-8B", undefined, "chat")).toEqual({
      supportsChat: false,
      supportsEmbedding: true,
    });
  });

  test("classifies common instruct and chat models as chat models", () => {
    expect(
      inferModelCapabilities("mistralai/mistral-7b-instruct", undefined, "embedding"),
    ).toEqual({
      supportsChat: true,
      supportsEmbedding: false,
    });
  });

  test("uses metadata when model id is not descriptive", () => {
    expect(
      inferModelCapabilities(
        "provider/model-a",
        { capabilities: ["embeddings"], type: "model" },
        "chat",
      ),
    ).toEqual({
      supportsChat: false,
      supportsEmbedding: true,
    });
  });

  test("falls back to the fetch endpoint kind for unknown models", () => {
    expect(inferModelCapabilities("provider/custom-model", undefined, "embedding")).toEqual({
      supportsChat: false,
      supportsEmbedding: true,
    });
  });
});
