import { describe, expect, test } from "bun:test";
import {
  buildChatContextWindow,
  estimateMessagesTokens,
  estimateTextTokens,
} from "@/lib/chat/context-window";
import type { ChatUIMessage } from "@/lib/chat/types";

describe("chat context window", () => {
  test("does not compress below the token threshold", async () => {
    const messages = [message("1", "user", "你好")];

    const result = await buildChatContextWindow(messages, {
      thresholdTokens: 100,
      compress: async () => {
        throw new Error("should not compress");
      },
    });

    expect(result.messages).toEqual(messages);
    expect(result.metadata.compressed).toBe(false);
    expect(result.metadata.originalMessageCount).toBe(1);
  });

  test("compresses older history and keeps the latest sliding window", async () => {
    const messages = [
      message("1", "user", "第一段很长的背景"),
      message("2", "assistant", "第二段很长的回复"),
      message("3", "user", "最新问题"),
    ];

    const result = await buildChatContextWindow(messages, {
      thresholdTokens: 1,
      recentWindowTokens: estimateTextTokens("最新问题"),
      compress: async (historyText) => {
        expect(historyText).toContain("第一段很长的背景");
        expect(historyText).toContain("第二段很长的回复");
        expect(historyText).not.toContain("最新问题");
        return "早期历史摘要";
      },
    });

    expect(result.metadata.compressed).toBe(true);
    expect(result.metadata.summarizedMessageCount).toBe(2);
    expect(result.metadata.retainedMessageCount).toBe(1);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.id).toBe("3");
  });

  test("estimates mixed Chinese and ASCII text", () => {
    const messages = [message("1", "user", "你好 hello")];

    expect(estimateTextTokens("你好 hello")).toBe(4);
    expect(estimateMessagesTokens(messages)).toBe(4);
  });
});

function message(id: string, role: ChatUIMessage["role"], text: string): ChatUIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}
