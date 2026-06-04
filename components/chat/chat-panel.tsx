"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { mockArticles } from "@/lib/mock/feed";
import { Button } from "@/components/retroui/Button";

/**
 * RAG 问答面板 — Manus 风格双栏布局
 * 左侧：新建聊天 + 按时间分组的历史记录
 * 右侧：始终可见的输入框；空态显示欢迎页与快捷指令，有消息时显示对话流。
 * 输入即建会话：未选中会话时直接发送会自动新建一段对话。
 */
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citedArticleIds?: number[];
  id: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

const QUICK_ACTIONS = [
  { label: "分析订阅文章", icon: PenTool },
  { label: "总结今日精选", icon: Sparkles },
  { label: "跨源主题追踪", icon: Globe },
  { label: "引用溯源问答", icon: FileText },
];

const DAY = 86_400_000;

/** 按更新时间把会话分到「今天 / 昨天 / 更早」三组，空组不渲染。 */
function groupByRecency(sessions: ChatSession[]) {
  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const buckets: { key: string; label: string; items: ChatSession[] }[] = [
    { key: "today", label: "今天", items: [] },
    { key: "yesterday", label: "昨天", items: [] },
    { key: "earlier", label: "更早", items: [] },
  ];
  for (const s of sessions) {
    const t = s.updatedAt.getTime();
    if (t >= startOfToday) buckets[0].items.push(s);
    else if (t >= startOfToday - DAY) buckets[1].items.push(s);
    else buckets[2].items.push(s);
  }
  return buckets.filter((b) => b.items.length > 0);
}

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: "1",
    title: "AI 平台竞争分析",
    messages: [
      { id: "msg-1", role: "user", content: "最近 AI 平台竞争的核心变化是什么?" },
      {
        id: "msg-2",
        role: "assistant",
        content:
          "竞争焦点正从模型能力转向分发与集成:模型差距收窄后,掌握用户入口和集成深度的一方更有优势。",
        citedArticleIds: [101, 102],
      },
    ],
    createdAt: new Date(Date.now() - DAY),
    updatedAt: new Date(Date.now() - DAY),
  },
  {
    id: "2",
    title: "FastMCP 组合方案",
    messages: [
      { id: "msg-3", role: "user", content: "如何组合多个 FastMCP 到主 MCP 服务?" },
      {
        id: "msg-4",
        role: "assistant",
        content: "可以通过代理模式将多个 FastMCP 服务整合到一个主服务中...",
      },
    ],
    createdAt: new Date(Date.now() - DAY * 3),
    updatedAt: new Date(Date.now() - DAY * 3),
  },
];

export function ChatPanel() {
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const hasMessages = (activeSession?.messages.length ?? 0) > 0;

  const filtered =
    query.trim() === ""
      ? sessions
      : sessions.filter((s) =>
          s.title.toLowerCase().includes(query.trim().toLowerCase()),
        );
  const groups = groupByRecency(filtered);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isTyping]);

  const createNewSession = useCallback(() => {
    setActiveSessionId(null);
    setInput("");
  }, []);

  const deleteSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setActiveSessionId((cur) => (cur === sessionId ? null : cur));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: text,
        id: Date.now().toString(),
      };

      // 未选中会话 → 输入即建会话
      let targetId = activeSessionId;
      if (!targetId) {
        const fresh: ChatSession = {
          id: Date.now().toString(),
          title: text.slice(0, 24) + (text.length > 24 ? "…" : ""),
          messages: [userMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        targetId = fresh.id;
        setSessions((prev) => [fresh, ...prev]);
        setActiveSessionId(fresh.id);
      } else {
        const id = targetId;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  messages: [...s.messages, userMessage],
                  updatedAt: new Date(),
                  title:
                    s.messages.length === 0
                      ? text.slice(0, 24) + (text.length > 24 ? "…" : "")
                      : s.title,
                }
              : s,
          ),
        );
      }

      setInput("");
      setIsTyping(true);
      const replyFor = targetId;
      setTimeout(() => {
        const aiMessage: ChatMessage = {
          role: "assistant",
          content:
            "这是一段模拟回答。接入向量检索后，将基于你的订阅内容给出精准答案，并在下方附上来源引用。",
          citedArticleIds: [101, 102],
          id: (Date.now() + 1).toString(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === replyFor
              ? { ...s, messages: [...s.messages, aiMessage], updatedAt: new Date() }
              : s,
          ),
        );
        setIsTyping(false);
      }, 1400);
    },
    [input, activeSessionId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4">
          {groups.length === 0 ? (
            <SidebarEmpty hasQuery={query.trim() !== ""} />
          ) : (
            groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-0.5">
                <span className="px-3 pb-1 pt-2 text-micro font-semibold uppercase tracking-wider text-stone">
                  {group.label}
                </span>
                <AnimatePresence initial={false}>
                  {group.items.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      active={activeSessionId === session.id}
                      onSelect={() => setActiveSessionId(session.id)}
                      onDelete={(e) => deleteSession(session.id, e)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── 右侧：对话区 / 欢迎页，输入框始终可见 ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {hasMessages ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
                <div className="flex flex-col gap-6">
                  <AnimatePresence mode="popLayout">
                    {activeSession!.messages.map((message) => (
                      <motion.div
                        key={message.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      >
                        <MessageBubble message={message} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isTyping && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
            <div className="border-t border-hairline bg-background/80 px-4 py-4 backdrop-blur-sm md:px-6">
              <MessageInput
                input={input}
                setInput={setInput}
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
                setInput={setInput}
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
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors",
          active
            ? "bg-primary/5 text-primary"
            : "text-charcoal hover:bg-surface hover:text-ink",
        )}
      >
        <MessageSquare
          size={15}
          aria-hidden
          className={cn("shrink-0", active ? "text-primary" : "text-stone")}
        />
        <span className="min-w-0 flex-1 truncate text-body-sm">{session.title}</span>
        <span
          role="button"
          tabIndex={-1}
          onClick={onDelete}
          aria-label="删除对话"
          className="shrink-0 rounded p-0.5 text-stone opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 size={14} aria-hidden />
        </span>
      </button>
    </motion.div>
  );
}

function SidebarEmpty({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-surface text-stone">
        {hasQuery ? <Search size={16} aria-hidden /> : <MessageSquare size={16} aria-hidden />}
      </span>
      <p className="text-body-sm text-steel">
        {hasQuery ? "没有匹配的聊天记录" : "还没有聊天记录"}
      </p>
      {!hasQuery && (
        <p className="text-caption text-stone">点击「新建聊天」开始第一段对话</p>
      )}
    </div>
  );
}

function MessageInput({
  input,
  setInput,
  onSubmit,
  onKeyDown,
  autoFocus,
}: {
  input: string;
  setInput: (value: string) => void;
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
          onChange={(e) => setInput(e.target.value)}
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

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-body-md text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const cited = (message.citedArticleIds ?? [])
    .map((id) => mockArticles.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface px-4 py-3 text-body-md leading-relaxed text-charcoal">
          <Streamdown
            parseIncompleteMarkdown
            linkSafety={{ enabled: true }}
            className="prose prose-sm max-w-none break-words text-charcoal prose-headings:text-ink prose-strong:text-ink prose-a:text-primary prose-code:text-ink"
          >
            {message.content}
          </Streamdown>
        </div>
      </div>
      {cited.length > 0 && <SourceCitations articles={cited} />}
    </div>
  );
}

function SourceCitations({ articles }: { articles: typeof mockArticles }) {
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
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-soft p-3 no-underline transition-all hover:border-primary/30 hover:bg-surface"
          >
            <FileText size={16} aria-hidden className="shrink-0 text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-sm-medium text-ink">
                {article.title}
              </span>
              <span className="truncate text-caption text-steel">
                {article.feedTitle}
              </span>
            </span>
          </a>
        ))}
      </div>
    </motion.div>
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
