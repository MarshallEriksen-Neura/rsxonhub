import { describe, expect, test } from "bun:test";
import { extractMessageText } from "@/lib/ai/chat-message";

describe("chat message text extraction", () => {
  test("reads current UIMessage text parts", () => {
    expect(
      extractMessageText({
        role: "user",
        parts: [
          { type: "step-start" },
          { type: "text", text: " hello " },
          { type: "text", text: "world" },
        ],
      }),
    ).toBe("hello \nworld");
  });

  test("keeps legacy content fallback", () => {
    expect(extractMessageText({ role: "user", content: " hello " })).toBe("hello");
  });

  test("returns empty text for non-text messages", () => {
    expect(extractMessageText({ role: "user", parts: [{ type: "file" }] })).toBe("");
  });
});
