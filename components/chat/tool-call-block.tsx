"use client";

import { useState } from "react";
import {
  Search,
  Type,
  FileText,
  Rss,
  Sparkles,
  Wrench,
  Check,
  Loader2,
  TriangleAlert,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { ChatUIMessage } from "@/lib/chat/types";

/**
 * 工具调用展示 block — 与 ThinkingBlock / SourceCitations 同一套视觉语言。
 *
 * AI SDK v6 会把工具调用作为 `tool-<name>` 类型的 part 推流进 message.parts，
 * 并随 assistant.parts 持久化。所以这里直接从 parts 渲染，流式实时态与历史回看态共用同一路径。
 */

type ToolPart = {
  type: `tool-${string}`;
  toolCallId?: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ToolMeta = {
  label: string;
  icon: typeof Search;
};

const TOOL_META: Record<string, ToolMeta> = {
  searchArticles: { label: "语义检索", icon: Search },
  findArticlesByKeyword: { label: "关键词搜索", icon: Type },
  getArticleContent: { label: "读取全文", icon: FileText },
  listFeeds: { label: "列出订阅源", icon: Rss },
  getLatestDigest: { label: "获取每日精选", icon: Sparkles },
};

function toolName(type: string): string {
  return type.startsWith("tool-") ? type.slice("tool-".length) : type;
}

function metaFor(name: string): ToolMeta {
  return TOOL_META[name] ?? { label: name, icon: Wrench };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把工具入参压成一行人类可读的摘要 */
function inputSummary(name: string, input: unknown): string | null {
  if (!isRecord(input)) return null;
  if (typeof input.query === "string" && input.query.trim()) return `“${input.query.trim()}”`;
  if (typeof input.keyword === "string" && input.keyword.trim()) return `“${input.keyword.trim()}”`;
  if (typeof input.articleId === "number") return `文章 #${input.articleId}`;
  return null;
}

/** 从工具返回里数出结果条数，用于结果角标 */
function resultCount(output: unknown): number | null {
  if (!isRecord(output)) return null;
  if (Array.isArray(output.results)) return output.results.length;
  if (Array.isArray(output.articles)) return output.articles.length;
  if (Array.isArray(output.feeds)) return output.feeds.length;
  if (isRecord(output.digest) && Array.isArray(output.digest.items)) {
    return output.digest.items.length;
  }
  if (output.digest === null) return 0;
  if (output.id != null) return 1; // getArticleContent 单篇
  return null;
}

function outputError(output: unknown): string | null {
  if (isRecord(output) && typeof output.error === "string") return output.error;
  if (isRecord(output) && typeof output.warning === "string") return output.warning;
  return null;
}

function extractToolParts(message: ChatUIMessage): ToolPart[] {
  return message.parts.filter(
    (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
  ) as unknown as ToolPart[];
}

export function hasToolCalls(message: ChatUIMessage): boolean {
  return message.parts.some((p) => typeof p.type === "string" && p.type.startsWith("tool-"));
}

export function ToolCallBlock({ message }: { message: ChatUIMessage }) {
  const parts = extractToolParts(message);
  if (parts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1.5"
    >
      <span className="text-micro font-semibold uppercase tracking-wider text-stone">
        工具调用
      </span>
      <div className="flex flex-col gap-1">
        {parts.map((part, i) => (
          <ToolCallRow key={part.toolCallId ?? `${part.type}-${i}`} part={part} />
        ))}
      </div>
    </motion.div>
  );
}

function ToolCallRow({ part }: { part: ToolPart }) {
  const name = toolName(part.type);
  const { label, icon: Icon } = metaFor(name);
  const summary = inputSummary(name, part.input);

  const isRunning = part.state === "input-streaming" || part.state === "input-available";
  const isError = part.state === "output-error" || outputError(part.output) != null;
  const count = part.state === "output-available" ? resultCount(part.output) : null;
  const errText = part.errorText ?? outputError(part.output);

  const [open, setOpen] = useState(false);
  const hasDetail = part.input != null || part.output != null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface-soft overflow-hidden transition-colors",
        isError ? "border-destructive/25" : "border-hairline",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
          hasDetail && "hover:bg-surface",
        )}
      >
        <Icon
          size={13}
          aria-hidden
          className={cn("shrink-0", isError ? "text-destructive" : "text-primary")}
        />
        <span className="shrink-0 text-body-sm-medium text-ink">{label}</span>
        {summary && (
          <span className="min-w-0 flex-1 truncate text-caption text-steel">{summary}</span>
        )}
        <span className={cn("flex shrink-0 items-center gap-1", !summary && "ml-auto")}>
          {isRunning ? (
            <Loader2 size={13} aria-hidden className="animate-spin text-stone" />
          ) : isError ? (
            <TriangleAlert size={13} aria-hidden className="text-destructive" />
          ) : (
            <>
              {count != null && (
                <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">
                  {count} 条
                </span>
              )}
              <Check size={13} aria-hidden className="text-emerald-600" />
            </>
          )}
        </span>
        {hasDetail && (
          <ChevronDown
            size={13}
            aria-hidden
            className={cn(
              "shrink-0 text-stone transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-hairline px-2.5 py-2">
              {part.input != null && (
                <DetailRow label="入参" value={part.input} />
              )}
              {errText ? (
                <p className="text-caption leading-relaxed text-destructive">{errText}</p>
              ) : (
                part.output != null && <DetailRow label="返回" value={part.output} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="space-y-0.5">
      <span className="text-micro font-semibold uppercase tracking-wider text-stone">
        {label}
      </span>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-1.5 text-[11px] leading-relaxed text-steel">
        {text}
      </pre>
    </div>
  );
}
