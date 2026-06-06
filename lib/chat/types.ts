import type { UIMessage } from "ai";
import type { CitedArticle } from "@/lib/ai/rag";

export type ChatMessageMetadata = {
  conversationId?: number;
  citedArticles?: CitedArticle[];
  citedArticleIds?: number[];
  finishReason?: string;
  usage?: Record<string, unknown>;
  error?: string;
  contextWindow?: {
    compressed: boolean;
    thresholdTokens: number;
    estimatedTokens: number;
    originalMessageCount: number;
    retainedMessageCount: number;
    summarizedMessageCount?: number;
    summaryEstimatedTokens?: number;
  };
};

export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export type ConversationSummary = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};
