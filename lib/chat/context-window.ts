import { generateText, type UIMessage } from "ai";
import { extractMessageText } from "@/lib/ai/chat-message";
import { CHAT_CONTEXT_COMPRESSION_SYSTEM } from "@/lib/ai/prompts";
import type { ChatMessageMetadata, ChatUIMessage } from "@/lib/chat/types";

export const CHAT_CONTEXT_COMPRESSION_THRESHOLD_TOKENS = 238_000;
export const CHAT_CONTEXT_RECENT_WINDOW_TOKENS = 64_000;

type BuildChatContextWindowOptions = {
  thresholdTokens?: number;
  recentWindowTokens?: number;
  compress?: (historyText: string) => Promise<string>;
};

export type ChatContextWindow = {
  messages: ChatUIMessage[];
  metadata: ChatMessageMetadata["contextWindow"];
};

export async function buildChatContextWindow(
  messages: ChatUIMessage[],
  options: BuildChatContextWindowOptions = {},
): Promise<ChatContextWindow> {
  const thresholdTokens =
    options.thresholdTokens ?? CHAT_CONTEXT_COMPRESSION_THRESHOLD_TOKENS;
  const recentWindowTokens =
    options.recentWindowTokens ?? CHAT_CONTEXT_RECENT_WINDOW_TOKENS;
  const estimatedTokens = estimateMessagesTokens(messages);

  if (estimatedTokens < thresholdTokens) {
    return {
      messages,
      metadata: {
        compressed: false,
        thresholdTokens,
        estimatedTokens,
        originalMessageCount: messages.length,
        retainedMessageCount: messages.length,
      },
    };
  }

  const { olderMessages, recentMessages } = splitSlidingWindow(
    messages,
    recentWindowTokens,
  );

  if (olderMessages.length === 0) {
    return {
      messages,
      metadata: {
        compressed: false,
        thresholdTokens,
        estimatedTokens,
        originalMessageCount: messages.length,
        retainedMessageCount: messages.length,
      },
    };
  }

  const summary = await (options.compress ?? compressChatHistory)(
    formatMessagesForCompression(olderMessages),
  );
  const summaryMessage = createSummaryMessage(summary);
  const windowMessages = [summaryMessage, ...recentMessages];

  return {
    messages: windowMessages,
    metadata: {
      compressed: true,
      thresholdTokens,
      estimatedTokens,
      originalMessageCount: messages.length,
      retainedMessageCount: recentMessages.length,
      summarizedMessageCount: olderMessages.length,
      summaryEstimatedTokens: estimateTextTokens(summary),
    },
  };
}

export function estimateMessagesTokens(messages: UIMessage[]) {
  return messages.reduce(
    (total, message) => total + estimateTextTokens(extractMessageText(message)),
    0,
  );
}

export function estimateTextTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;

  let asciiRunLength = 0;
  let tokens = 0;
  for (const char of normalized) {
    if (/[\x00-\x7F]/.test(char)) {
      asciiRunLength += 1;
      continue;
    }

    tokens += Math.ceil(asciiRunLength / 4);
    asciiRunLength = 0;
    tokens += 1;
  }

  return tokens + Math.ceil(asciiRunLength / 4);
}

function splitSlidingWindow(messages: ChatUIMessage[], recentWindowTokens: number) {
  const recentMessages: ChatUIMessage[] = [];
  let recentTokens = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const messageTokens = estimateTextTokens(extractMessageText(message));
    if (recentMessages.length > 0 && recentTokens + messageTokens > recentWindowTokens) {
      break;
    }

    recentMessages.unshift(message);
    recentTokens += messageTokens;
  }

  return {
    olderMessages: messages.slice(0, messages.length - recentMessages.length),
    recentMessages,
  };
}

async function compressChatHistory(historyText: string) {
  const { chatModel } = await import("@/lib/ai");
  const model = await chatModel();
  const result = await generateText({
    model,
    system: CHAT_CONTEXT_COMPRESSION_SYSTEM,
    prompt: historyText,
  });

  return result.text.trim();
}

function formatMessagesForCompression(messages: ChatUIMessage[]) {
  return messages
    .map((message, index) => {
      const content = extractMessageText(message);
      return `<message index="${index + 1}" role="${message.role}">\n${content}\n</message>`;
    })
    .join("\n\n");
}

function createSummaryMessage(summary: string): ChatUIMessage {
  return {
    id: "context-summary",
    role: "system",
    parts: [
      {
        type: "text",
        text: `以下是较早聊天历史的压缩摘要，作为后续回答的背景，不是用户的新请求：\n${summary}`,
      },
    ],
  };
}
