import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatModel } from "@/lib/ai";
import { extractMessageText } from "@/lib/ai/chat-message";
import { CHAT_AGENT_SYSTEM } from "@/lib/ai/prompts";
import type { CitedArticle } from "@/lib/ai/rag";
import { createChatTools } from "@/lib/ai/tools";
import {
  appendMessage,
  createConversation,
  getConversation,
  getConversationMessages,
} from "@/lib/chat/conversations";
import type { ChatMessageMetadata, ChatUIMessage } from "@/lib/chat/types";

type ChatRequestBody = {
  messages?: UIMessage[];
  conversationId?: number | string | null;
};

type ToolEvent = {
  tool: string;
  input?: Record<string, unknown>;
  resultCount?: number;
};

export type { ChatMessageMetadata };

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as ChatRequestBody;
  const requestMessages = Array.isArray(body.messages) ? body.messages : [];
  if (requestMessages.length === 0) {
    return NextResponse.json({ error: "EMPTY_MESSAGES" }, { status: 400 });
  }

  const lastUserMessage = [...requestMessages]
    .reverse()
    .find((m) => m.role === "user");
  const userText = extractMessageText(lastUserMessage);
  if (!userText) {
    return NextResponse.json({ error: "EMPTY_MESSAGE" }, { status: 400 });
  }

  const requestedConversationId = parseConversationId(body.conversationId);
  const conversation = requestedConversationId
    ? await getConversation(requestedConversationId)
    : await createConversation({ title: makeTitle(userText) });

  if (!conversation) {
    return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
  }

  const conversationId = conversation.id;
  await appendMessage({
    conversationId,
    role: "user",
    content: userText,
    parts: lastUserMessage?.parts,
  });

  const historyMessages = await getConversationMessages(conversationId);
  const citedArticles = new Map<number, CitedArticle>();
  const toolEvents: ToolEvent[] = [];
  let finishReason: string | undefined;
  let usage: Record<string, unknown> | undefined;
  let persistedError = false;

  const tools = createChatTools({
    onCitation: (article) => {
      citedArticles.set(article.id, article);
    },
    onToolEvent: (event) => {
      toolEvents.push(event);
    },
  });

  const model = await chatModel();
  const modelMessages = await convertToModelMessages(historyMessages);
  const result = streamText({
    model,
    system: CHAT_AGENT_SYSTEM,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
    onFinish: (event) => {
      finishReason = event.finishReason;
      usage = event.totalUsage as unknown as Record<string, unknown>;
    },
    onError: async ({ error }) => {
      if (persistedError) return;
      persistedError = true;
      await appendMessage({
        conversationId,
        role: "assistant",
        content: "生成回复时出现错误，请稍后重试。",
        metadata: {
          conversationId,
          error: error instanceof Error ? error.message : "UNKNOWN_STREAM_ERROR",
        },
      });
    },
  });

  return result.toUIMessageStreamResponse<ChatUIMessage>({
    originalMessages: historyMessages,
    messageMetadata: ({ part }) => {
      if (part.type !== "start" && part.type !== "finish") return undefined;
      return buildMetadata(conversationId, citedArticles, finishReason, usage);
    },
    onFinish: async ({ messages }) => {
      if (persistedError) return;
      const assistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (!assistant) return;

      const metadata = buildMetadata(
        conversationId,
        citedArticles,
        finishReason,
        usage,
      );
      const citedArticleIds = metadata.citedArticleIds;

      await appendMessage({
        conversationId,
        role: "assistant",
        content: extractMessageText(assistant),
        parts: assistant.parts,
        citedArticleIds,
        metadata: {
          ...metadata,
          toolEvents,
        } as ChatMessageMetadata,
      });
    },
  });
}

function parseConversationId(value: ChatRequestBody["conversationId"]) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function makeTitle(text: string) {
  return text.slice(0, 24) + (text.length > 24 ? "..." : "");
}

function buildMetadata(
  conversationId: number,
  citedArticles: Map<number, CitedArticle>,
  finishReason?: string,
  usage?: Record<string, unknown>,
): ChatMessageMetadata {
  const articles = Array.from(citedArticles.values());
  return {
    conversationId,
    citedArticles: articles,
    citedArticleIds: articles.map((article) => article.id),
    ...(finishReason ? { finishReason } : {}),
    ...(usage ? { usage } : {}),
  };
}
