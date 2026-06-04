"use client";

import { useState } from "react";
import { Send, FileText } from "lucide-react";
import { mockArticles } from "@/lib/mock/feed";

/**
 * RAG 问答面板(布局占位)。消息流 + 来源引用卡 + 底部输入。
 * 引用卡是 RAG 招牌特性,必须显眼:每条 AI 回答下挂被引用文章。
 */
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citedArticleIds?: number[];
};

const DEMO: ChatMessage[] = [
  { role: "user", content: "最近 AI 平台竞争的核心变化是什么?" },
  {
    role: "assistant",
    content:
      "竞争焦点正从模型能力转向分发与集成:模型差距收窄后,掌握用户入口和集成深度的一方更有优势。(占位回答,后端接入向量检索后由真实引用支撑)",
    citedArticleIds: [101, 102],
  },
];

export function ChatPanel() {
  const [input, setInput] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
          {DEMO.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
        </div>
      </div>

      <div className="border-t border-border p-4">
        <form
          className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-border bg-background px-4 py-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="就你的订阅库提问…"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body-md outline-none focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="发送"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Send size={16} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-body-md text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const cited = (message.citedArticleIds ?? [])
    .map((id) => mockArticles.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="flex flex-col gap-3">
      <div className="text-body-md leading-relaxed">{message.content}</div>
      {cited.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            来源引用
          </span>
          <div className="flex flex-col gap-2">
            {cited.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="card-base flex items-center gap-3 !p-3 no-underline transition-shadow hover:shadow-card"
              >
                <FileText size={16} aria-hidden className="shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-sm-medium text-foreground">
                    {a.title}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {a.feedTitle}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
