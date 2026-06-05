import { and, asc, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { extractMessageText } from "@/lib/ai/chat-message";
import {
  encodeConversationCursor,
  type ConversationCursor,
} from "@/lib/chat/conversation-cursor";
import type { ChatMessageMetadata, ChatUIMessage } from "@/lib/chat/types";

type AppendMessageInput = {
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: UIMessage["parts"];
  citedArticleIds?: number[];
  metadata?: ChatMessageMetadata;
};

type ListConversationsOptions = {
  limit?: number;
  cursor?: ConversationCursor | null;
  search?: string | null;
};

export async function listConversations(options: ListConversationsOptions = {}) {
  const limit = clamp(options.limit ?? 20, 1, 100);
  const queryLimit = limit + 1;
  const conditions = [];
  const search = options.search?.trim();

  if (search) {
    conditions.push(ilike(conversations.title, `%${search}%`));
  }

  if (options.cursor) {
    const cursorUpdatedAt = new Date(options.cursor.updatedAt);
    conditions.push(
      or(
        lt(conversations.updatedAt, cursorUpdatedAt),
        and(
          eq(conversations.updatedAt, cursorUpdatedAt),
          lt(conversations.id, options.cursor.id),
        ),
      ),
    );
  }

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(conditions.length ? sql.join(conditions, sql` and `) : undefined)
    .orderBy(desc(conversations.updatedAt), desc(conversations.id))
    .limit(queryLimit);

  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1);
  const hasMore = rows.length > limit;

  return {
    conversations: pageRows.map((row) => ({
    id: row.id,
    title: row.title ?? "新对话",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && lastRow
          ? encodeConversationCursor({
              updatedAt: lastRow.updatedAt.toISOString(),
              id: lastRow.id,
            })
          : null,
    },
  };
}

export async function getConversation(conversationId: number) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return row ?? null;
}

export async function getConversationMessages(
  conversationId: number,
): Promise<ChatUIMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      parts: messages.parts,
      metadata: messages.metadata,
      citedArticleIds: messages.citedArticleIds,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  return rows.map((row) => {
    const metadata = normalizeMetadata(row.metadata, row.citedArticleIds);
    return {
      id: String(row.id),
      role: row.role,
      parts:
        row.parts && row.parts.length > 0
          ? (row.parts as ChatUIMessage["parts"])
          : [{ type: "text", text: row.content }],
      ...(metadata ? { metadata } : {}),
    };
  });
}

export async function createConversation({ title }: { title?: string }) {
  const [row] = await db
    .insert(conversations)
    .values({ title: normalizeTitle(title) })
    .returning();

  return row;
}

export async function appendMessage(input: AppendMessageInput) {
  const metadata = input.metadata
    ? (input.metadata as Record<string, unknown>)
    : undefined;

  const [row] = await db
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      parts: (input.parts as Record<string, unknown>[] | undefined) ?? [
        { type: "text", text: input.content },
      ],
      citedArticleIds: input.citedArticleIds,
      metadata,
    })
    .returning();

  await touchConversation(input.conversationId);
  return row;
}

export async function touchConversation(conversationId: number) {
  await db
    .update(conversations)
    .set({ updatedAt: sql`now()` })
    .where(eq(conversations.id, conversationId));
}

export async function deleteConversation(conversationId: number) {
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

export function messageContent(message: unknown) {
  return extractMessageText(message);
}

function normalizeTitle(title: string | undefined) {
  const value = title?.trim();
  if (!value) return "新对话";
  return value.slice(0, 48);
}

function normalizeMetadata(
  metadata: Record<string, unknown> | null,
  citedArticleIds: number[] | null,
): ChatMessageMetadata | undefined {
  const merged: ChatMessageMetadata = {
    ...(metadata ?? {}),
    ...(citedArticleIds && citedArticleIds.length > 0 ? { citedArticleIds } : {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
