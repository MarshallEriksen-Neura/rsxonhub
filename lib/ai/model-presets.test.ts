import { describe, expect, test } from "bun:test";
import {
  buildChatModelSelectionSnapshot,
  inferModelCapabilities,
  resolveChatModelSelection,
} from "@/lib/ai/model-presets";

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

  test("builds a deduplicated chat model selection with the default first", () => {
    expect(
      buildChatModelSelectionSnapshot("provider/default", [
        { model: "provider/zeta", supportsChat: true, supportsEmbedding: false },
        { model: "provider/default", supportsChat: true, supportsEmbedding: false },
        { model: "provider/embed", supportsChat: false, supportsEmbedding: true },
        { model: "provider/alpha", supportsChat: true, supportsEmbedding: false },
        { model: "provider/alpha", supportsChat: true, supportsEmbedding: false },
      ]),
    ).toEqual({
      defaultModel: "provider/default",
      models: ["provider/default", "provider/alpha", "provider/zeta"],
    });
  });

  test("resolves only models advertised by the current chat endpoint", () => {
    const snapshot = {
      defaultModel: "provider/default",
      models: ["provider/default", "provider/alternate"],
    };

    expect(resolveChatModelSelection(undefined, snapshot)).toBe("provider/default");
    expect(resolveChatModelSelection(" provider/alternate ", snapshot)).toBe(
      "provider/alternate",
    );
    expect(() => resolveChatModelSelection("provider/unknown", snapshot)).toThrow(
      "INVALID_CHAT_MODEL",
    );
  });
});
