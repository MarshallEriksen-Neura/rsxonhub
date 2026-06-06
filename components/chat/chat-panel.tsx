"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Plus,
  MessageSquare,
  Trash2,
  Sparkles,
  Paperclip,
  Globe,
  PenTool,
  Search,
  ArrowUp,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, jsonSchema } from "ai";

import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { mermaid } from "@streamdown/mermaid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/retroui/Button";
import {
  VirtualScroll,
  useVirtualScroll,
  type VirtualScrollItem,
} from "@/components/feed/virtual-scroll";
import type { CitedArticle } from "@/lib/ai/rag";
import type {
  ChatUIMessage,
  ConversationSummary,
} from "@/lib/chat/types";

/**
 * RAG 问答面板 — Manus 风格双栏布局
 * 左侧：新建聊天 + 按时间分组的历史记录
 * 右侧：始终可见的输入框；空态显示欢迎页与快捷指令，有消息时显示对话流。
 * 输入即建会话：未选中会话时直接发送会自动新建一段对话。
 */
type ChatSession = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

type HistoryListItem =
  | { kind: "group"; id: string; label: string }
  | { kind: "session"; id: string; session: ChatSession };

const QUICK_ACTIONS = [
  { label: "分析订阅文章", icon: PenTool },
  { label: "总结今日精选", icon: Sparkles },
  { label: "跨源主题追踪", icon: Globe },
  { label: "引用溯源问答", icon: FileText },
];

const DAY = 86_400_000;
const ASSISTANT_ERROR_PREFIX = "生成回复时出现错误：";

/** 按更新时间把会话分到「今天 / 昨天 / 更早」三组，空组不渲染。 */
function groupByRecency(sessions: ChatSession[]) {
  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const buckets: { key: string; label: string; items: ChatSession[] }[] = [
    { key: "earlier", label: "更早", items: [] },
    { key: "yesterday", label: "昨天", items: [] },
    { key: "today", label: "今天", items: [] },
  ];
  for (const s of sessions) {
    const t = s.updatedAt.getTime();
    if (t >= startOfToday) buckets[2].items.push(s);
    else if (t >= startOfToday - DAY) buckets[1].items.push(s);
    else buckets[0].items.push(s);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function toHistoryItems(sessions: ChatSession[]): VirtualScrollItem<HistoryListItem>[] {
  return groupByRecency(sessions).flatMap((group) => [
    {
      id: `group-${group.key}`,
      data: { kind: "group", id: group.key, label: group.label },
    },
    ...group.items.map((session) => ({
      id: `session-${session.id}`,
      data: { kind: "session" as const, id: session.id, session },
    })),
  ]);
}

export function ChatPanel() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    items: conversationItems,
    state: conversationState,
    loadInitial: loadInitialConversations,
    loadMore: loadMoreConversations,
    retry: retryConversations,
    setItems: setConversationItems,
  } = useVirtualScroll<ChatSession>({
    pageSize: 24,
    loadDirection: "up",
  });

  const fetchConversations = useCallback(
    async (_page: number, size: number, cursor?: string | null) => {
      const params = new URLSearchParams({ limit: String(size) });
      if (cursor) params.set("cursor", cursor);
      if (query.trim()) params.set("search", query.trim());

      const response = await fetch(`/api/chat/conversations?${params}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        conversations?: ConversationSummary[];
        pagination?: { hasMore?: boolean; nextCursor?: string | null };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "聊天记录加载失败");
      }

      return {
        data: (payload.conversations ?? []).map(toChatSession).reverse(),
        hasMore: Boolean(payload.pagination?.hasMore),
        nextCursor: payload.pagination?.nextCursor ?? null,
      };
    },
    [query],
  );

  useEffect(() => {
    void loadInitialConversations(fetchConversations);
  }, [fetchConversations, loadInitialConversations]);

  const transport = useMemo(
    () => new DefaultChatTransport<ChatUIMessage>({ api: "/api/chat" }),
    [],
  );

  const { messages, setMessages, sendMessage, status } = useChat<ChatUIMessage>({
    transport,
    messageMetadataSchema: jsonSchema({ type: "object" }),
    onError: (error) => {
      setMessages((current) =>
        upsertAssistantErrorMessage(current, error, activeSessionId),
      );
      void loadInitialConversations(fetchConversations);
    },
    onFinish: ({ message }) => {
      const conversationId = message.metadata?.conversationId;
      if (conversationId) {
        setActiveSessionId(String(conversationId));
      }
      void loadInitialConversations(fetchConversations);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;

  const sessions = useMemo(
    () => conversationItems.map((item) => item.data),
    [conversationItems],
  );
  const historyItems = useMemo(() => toHistoryItems(sessions), [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const createNewSession = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    setDeleteConfirmSessionId(null);
    setInput("");
  }, [setMessages]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      setDeleteConfirmSessionId(null);
      const response = await fetch(`/api/chat/conversations/${sessionId}`);
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatUIMessage[] };
      setMessages(data.messages);
      setActiveSessionId(sessionId);
    },
    [setMessages],
  );

  const requestDeleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmSessionId(sessionId);
  }, []);

  const cancelDeleteSession = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmSessionId(null);
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeletingSessionId(sessionId);
      try {
        const response = await fetch(`/api/chat/conversations/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok) return;
        setDeleteConfirmSessionId(null);
        setConversationItems((current) =>
          current.filter((item) => item.data.id !== sessionId),
        );
        void loadInitialConversations(fetchConversations);
        if (activeSessionId === sessionId) {
          setMessages([]);
          setActiveSessionId(null);
        }
      } finally {
        setDeletingSessionId(null);
      }
    },
    [
      activeSessionId,
      fetchConversations,
      loadInitialConversations,
      setConversationItems,
      setMessages,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;
      setInput("");
      await sendMessage(
        { text },
        {
          body: {
            conversationId: activeSessionId ? Number(activeSessionId) : undefined,
          },
        },
      );
    },
    [input, isLoading, activeSessionId, sendMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      {/* ── 左侧：新建聊天 + 历史记录 ── */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-hairline bg-sidebar md:flex">
        <div className="flex flex-col gap-3 p-3">
          <Button
            type="button"
            onClick={createNewSession}
            className="w-full justify-start gap-2.5 bg-primary px-3.5 py-2.5 text-body-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary-hover active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden className="shrink-0" />
            新建聊天
          </Button>

          <label className="group relative flex items-center">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-3 text-stone transition-colors group-focus-within:text-steel"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索聊天记录"
              aria-label="搜索聊天记录"
              className="w-full rounded-md border border-hairline bg-surface-soft py-2 pl-9 pr-3 text-body-sm text-ink outline-none transition-colors placeholder:text-stone focus:border-primary/40 focus:bg-canvas"
            />
          </label>
        </div>

        <VirtualScroll
          items={historyItems}
          height={0}
          estimatedItemHeight={42}
          state={conversationState}
          onLoadMore={() => loadMoreConversations(fetchConversations)}
          onRetry={() => retryConversations(fetchConversations)}
          loadDirection="up"
          containerClassName="px-2 pb-4"
          showLoadingMoreIndicator
          loadingMoreText="加载聊天记录..."
          emptyState={{
            title: query.trim() ? "没有匹配的聊天记录" : "还没有聊天记录",
            description: query.trim()
              ? "换个关键词继续搜索"
              : "发送第一条消息后会自动保存会话",
          }}
          errorState={{
            title: "聊天记录加载失败",
            description: "请稍后重试",
            retryText: "重试",
          }}
          renderItem={(item) => (
            <HistoryItemRow
              item={item}
              activeSessionId={activeSessionId}
              deleteConfirmSessionId={deleteConfirmSessionId}
              deletingSessionId={deletingSessionId}
              onSelect={selectSession}
              onRequestDelete={requestDeleteSession}
              onCancelDelete={cancelDeleteSession}
              onConfirmDelete={deleteSession}
            />
          )}
        />
      </aside>

      {/* ── 右侧：对话区 / 欢迎页，输入框始终可见 ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {hasMessages ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
                <div className="flex flex-col gap-6">
                  <AnimatePresence mode="popLayout">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      >
                        <MessageBubble message={message} isStreaming={isLoading} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
            <div className="border-t border-hairline bg-background/80 px-4 py-4 backdrop-blur-sm md:px-6">
              <MessageInput
                input={input}
                onInputChange={(e) => setInput(e.target.value)}
                onSubmit={handleSubmit}
                onKeyDown={handleKeyDown}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full max-w-2xl flex-col items-center gap-8"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <h1 className="text-heading-2 font-heading text-ink">
                  我能为你做什么？
                </h1>
              </div>

              <MessageInput
                input={input}
                onInputChange={(e) => setInput(e.target.value)}
                onSubmit={handleSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
              />

              <QuickActions onPick={(label) => setInput(label + "：")} />
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  confirming,
  deleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  confirming: boolean;
  deleting: boolean;
  onRequestDelete: (e: React.MouseEvent) => void;
  onCancelDelete: (e: React.MouseEvent) => void;
  onConfirmDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <div
        className={cn(
          "group flex w-full items-center gap-1.5 rounded-md transition-colors",
          confirming
            ? "bg-destructive/5"
            : active
              ? "bg-primary/5"
              : "hover:bg-surface",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors",
            active ? "text-primary" : "text-charcoal hover:text-ink",
          )}
        >
          <MessageSquare
            size={15}
            aria-hidden
            className={cn("shrink-0", active ? "text-primary" : "text-stone")}
          />
          <span className="min-w-0 flex-1 truncate text-body-sm">{session.title}</span>
        </button>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-1 pr-1.5">
            <span className="hidden text-micro text-destructive xl:inline">
              确认删除?
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onConfirmDelete}
              disabled={deleting}
              className="h-7 gap-1 px-2 text-micro text-destructive hover:bg-destructive/10"
            >
              {deleting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={12} aria-hidden />
              )}
              删除
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onCancelDelete}
              disabled={deleting}
              aria-label="取消删除"
              className="size-7 text-stone hover:text-ink"
            >
              <X size={13} aria-hidden />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`删除对话：${session.title}`}
            className="mr-2 shrink-0 rounded p-1 text-stone opacity-0 transition-all hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function HistoryItemRow({
  item,
  activeSessionId,
  deleteConfirmSessionId,
  deletingSessionId,
  onSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  item: VirtualScrollItem<HistoryListItem>;
  activeSessionId: string | null;
  deleteConfirmSessionId: string | null;
  deletingSessionId: string | null;
  onSelect: (sessionId: string) => Promise<void>;
  onRequestDelete: (sessionId: string, e: React.MouseEvent) => void;
  onCancelDelete: (e: React.MouseEvent) => void;
  onConfirmDelete: (sessionId: string, e: React.MouseEvent) => Promise<void>;
}) {
  const data = item.data;

  if (data.kind === "group") {
    return (
      <span className="block px-3 pb-1 pt-2 text-micro font-semibold uppercase tracking-wider text-stone">
        {data.label}
      </span>
    );
  }

  return (
    <SessionRow
      session={data.session}
      active={activeSessionId === data.session.id}
      confirming={deleteConfirmSessionId === data.session.id}
      deleting={deletingSessionId === data.session.id}
      onSelect={() => void onSelect(data.session.id)}
      onRequestDelete={(event) => onRequestDelete(data.session.id, event)}
      onCancelDelete={onCancelDelete}
      onConfirmDelete={(event) => void onConfirmDelete(data.session.id, event)}
    />
  );
}

function MessageInput({
  input,
  onInputChange,
  onSubmit,
  onKeyDown,
  autoFocus,
}: {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自适应高度，最高 8rem 后内部滚动
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [input]);

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl">
      <div className="group relative flex flex-col gap-2 rounded-2xl border border-hairline bg-surface-soft p-2.5 transition-all focus-within:border-primary/40 focus-within:bg-canvas focus-within:shadow-card">
        <textarea
          ref={inputRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          placeholder="分配一个任务或提问任何问题…"
          rows={1}
          className="max-h-32 w-full resize-none border-0 bg-transparent px-2 pt-1.5 text-body-md text-ink outline-none placeholder:text-stone focus:outline-none focus-visible:outline-none"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="附件"
              className="size-8 rounded-lg text-stone hover:text-ink"
            >
              <Paperclip size={17} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="联网搜索"
              className="size-8 rounded-lg text-stone hover:text-ink"
            >
              <Globe size={17} aria-hidden />
            </Button>
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            aria-label="发送"
            className={cn(
              "size-9 rounded-xl transition-all active:scale-95",
              input.trim()
                ? "bg-primary text-primary-foreground shadow-subtle hover:bg-primary-hover"
                : "cursor-not-allowed bg-surface text-stone",
            )}
          >
            <ArrowUp size={18} aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-center text-micro text-stone">
        回答基于你的订阅内容生成，请核对来源引用。
      </p>
    </form>
  );
}

function QuickActions({ onPick }: { onPick: (label: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {QUICK_ACTIONS.map((action, index) => (
        <motion.button
          key={action.label}
          type="button"
          onClick={() => onPick(action.label)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 * index, ease: [0.16, 1, 0.3, 1] }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-soft px-3.5 py-2 text-body-sm text-charcoal transition-colors hover:border-primary/30 hover:bg-surface hover:text-ink"
        >
          <action.icon size={14} aria-hidden className="text-steel" />
          <span>{action.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

/** ai v6: UIMessage.parts replaces .content */
function messageText(message: ChatUIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function getErrorMessage(error: unknown) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : "UNKNOWN_CHAT_ERROR";
  return message.startsWith(ASSISTANT_ERROR_PREFIX)
    ? message.slice(ASSISTANT_ERROR_PREFIX.length)
    : message;
}

function formatAssistantError(error: unknown) {
  return `${ASSISTANT_ERROR_PREFIX}${getErrorMessage(error)}`;
}

function upsertAssistantErrorMessage(
  messages: ChatUIMessage[],
  error: unknown,
  activeSessionId: string | null,
): ChatUIMessage[] {
  const errorMessage = getErrorMessage(error);
  const text = formatAssistantError(error);
  const last = messages.at(-1);
  const metadata = {
    ...(last?.role === "assistant" ? last.metadata : {}),
    ...(activeSessionId ? { conversationId: Number(activeSessionId) } : {}),
    error: errorMessage,
  };

  if (last?.role === "assistant") {
    return [
      ...messages.slice(0, -1),
      {
        ...last,
        parts: [{ type: "text", text }],
        metadata,
      },
    ];
  }

  return [
    ...messages,
    {
      id: `chat-error-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text", text }],
      metadata,
    },
  ];
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatUIMessage;
  isStreaming: boolean;
}) {
  const text = messageText(message);
  const cited = message.metadata?.citedArticles;
  const error = message.metadata?.error;

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-body-md text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-start">
        <div
          className={cn(
            "max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-body-md leading-relaxed",
            error
              ? "border border-destructive/25 bg-destructive/5 text-destructive"
              : "bg-surface text-charcoal",
          )}
        >
          {error ? (
            <div className="flex gap-2.5">
              <AlertCircle
                size={18}
                aria-hidden
                className="mt-0.5 shrink-0 text-destructive"
              />
              <div className="min-w-0 space-y-1">
                <p className="break-words text-body-sm-medium text-destructive">
                  {text || "生成回复时出现错误。"}
                </p>
                {error && error !== text && (
                  <p className="break-words text-caption text-destructive/80">
                    {error}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Streamdown
              parseIncompleteMarkdown
              animated
              isAnimating={isStreaming}
              plugins={{ mermaid }}
              components={{
                pre: ({ children, ...props }) => (
                  <CodeBlockWithCopy {...props}>{children}</CodeBlockWithCopy>
                ),
              }}
              linkSafety={{ enabled: true }}
              className="prose prose-sm max-w-none break-words text-charcoal prose-headings:text-ink prose-strong:text-ink prose-a:text-primary prose-code:text-ink"
            >
              {text}
            </Streamdown>
          )}
        </div>
      </div>
      {cited && cited.length > 0 && <SourceCitations articles={cited} />}
    </div>
  );
}

function toChatSession(summary: ConversationSummary): ChatSession {
  return {
    id: String(summary.id),
    title: summary.title,
    createdAt: new Date(summary.createdAt),
    updatedAt: new Date(summary.updatedAt),
  };
}

function SourceCitations({ articles }: { articles: CitedArticle[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex flex-col gap-2"
    >
      <span className="text-micro font-semibold uppercase tracking-wider text-stone">
        来源引用
      </span>
      <div className="grid gap-2">
        {articles.map((article) => (
          <a
            key={article.id}
            href={article.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-soft p-3 no-underline transition-all hover:border-primary/30 hover:bg-surface"
          >
            <FileText size={16} aria-hidden className="shrink-0 text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-sm-medium text-ink">
                {article.title ?? "未知文章"}
              </span>
              <span className="truncate text-caption text-steel">
                {article.url ?? ""}
              </span>
            </span>
          </a>
        ))}
      </div>
    </motion.div>
  );
}

function CodeBlockWithCopy({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLPreElement>(null);

  const copy = () => {
    const text = ref.current?.textContent ?? "";
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <pre ref={ref} {...props} className="relative group">
      {children}
      <button
        type="button"
        onClick={copy}
        aria-label="复制代码"
        className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-micro bg-surface/80 text-stone opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
      >
        {copied ? "已复制" : "复制"}
      </button>
    </pre>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="size-1.5 rounded-full bg-steel"
              animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        <span className="text-caption text-steel">思考中…</span>
      </div>
    </div>
  );
}
