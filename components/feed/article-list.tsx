"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { articlesForView, type MockArticle } from "@/lib/mock/feed";
import { useFeedStore } from "@/lib/stores/feed";
import { ImportanceBadge, TagChip } from "./article-badges";

/**
 * /feed 中栏 · 文章列表。
 * 顶部 search-pill + segmented-tab(最新/重要度);
 * 每条:标题 + 来源 + 时间 + AI 重要度 + 标签 chips + 一行摘要预览。
 */
export function ArticleList() {
  const view = useFeedStore((s) => s.view);
  const search = useFeedStore((s) => s.search);
  const setSearch = useFeedStore((s) => s.setSearch);
  const selectedArticleId = useFeedStore((s) => s.selectedArticleId);
  const selectArticle = useFeedStore((s) => s.selectArticle);

  const articles = articlesForView(view).filter((a) =>
    search.trim()
      ? `${a.title} ${a.summary}`.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  return (
    <section className="flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-border md:w-96">
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
          <Search size={15} aria-hidden className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题或摘要"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body-sm outline-none focus-visible:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className="pill-tab pill-tab-active text-caption">
            最新
          </button>
          <button type="button" className="pill-tab text-caption">
            重要度
          </button>
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {articles.length === 0 ? (
          <li className="p-6 text-center text-body-sm text-muted-foreground">
            该视图下暂无文章
          </li>
        ) : (
          articles.map((article) => (
            <ArticleListItem
              key={article.id}
              article={article}
              active={selectedArticleId === article.id}
              onSelect={() => selectArticle(article.id)}
            />
          ))
        )}
      </ul>
    </section>
  );
}

function ArticleListItem({
  article,
  active,
  onSelect,
}: {
  article: MockArticle;
  active: boolean;
  onSelect: () => void;
}) {
  const unread = article.status === "unread";
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full flex-col gap-1.5 border-b border-border px-4 py-3 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-secondary-hover",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "text-body-sm leading-snug",
              unread ? "text-body-sm-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {article.title}
          </h3>
          <ImportanceBadge value={article.importance} />
        </div>

        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          {unread ? (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="未读" />
          ) : null}
          <span className="truncate">{article.feedTitle}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{formatTime(article.publishedAt)}</time>
        </div>

        <p className="line-clamp-1 text-caption text-muted-foreground">
          {article.summary}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {article.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag}>{tag}</TagChip>
          ))}
        </div>
      </button>
    </li>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
