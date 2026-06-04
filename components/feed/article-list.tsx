"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { articlesForView, type MockArticle, type Importance } from "@/lib/mock/feed";
import { useFeedStore } from "@/lib/stores/feed";
import { Badge } from "@/components/retroui/Badge";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { VirtualScroll, useVirtualScroll } from "./virtual-scroll";
import { useState, useMemo, useEffect } from "react";

// 重要性徽章变体配置
const importanceVariantMap: Record<Importance, "outline" | "surface" | "default"> = {
  high: "outline",
  medium: "surface",
  low: "default",
};

const importanceLabelMap: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/**
 * /feed 中栏 · 文章列表。
 * 改进:
 * - 使用虚拟滚动提升性能
 * - 支持无限滚动加载
 * - 空状态和异常状态处理
 * - 移除卡片背景，使用分割线和留白
 * - 更好的字体层次和间距
 * - 统一的悬停和激活状态
 * - 搜索框和筛选器更紧凑
 */
export function ArticleList() {
  const view = useFeedStore((s) => s.view);
  const search = useFeedStore((s) => s.search);
  const setSearch = useFeedStore((s) => s.setSearch);
  const selectedArticleId = useFeedStore((s) => s.selectedArticleId);
  const selectArticle = useFeedStore((s) => s.selectArticle);

  // 使用虚拟滚动 Hook
  const virtualScroll = useVirtualScroll<MockArticle>();
  
  // 获取所有文章数据
  const allArticles = useMemo(() => articlesForView(view), [view]);
  
  // 模拟分页加载数据
  const fetchArticles = async (page: number, size: number) => {
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // 过滤搜索
    const filtered = allArticles.filter((a) =>
      search.trim()
        ? `${a.title} ${a.summary}`.toLowerCase().includes(search.toLowerCase())
        : true,
    );
    
    // 分页
    const start = (page - 1) * size;
    const end = start + size;
    const pageArticles = filtered.slice(start, end);
    
    return {
      data: pageArticles,
      hasMore: end < filtered.length,
    };
  };
  
  // 当 view 或 search 变化时重新加载
  useEffect(() => {
    virtualScroll.loadInitial(fetchArticles);
  }, [view, search]);

  return (
    <section className="flex h-full w-96 shrink-0 flex-col overflow-hidden border-r border-hairline bg-background">
      {/* 搜索和筛选 */}
      <div className="flex flex-col gap-2 border-b border-hairline p-4">
        <div className="relative">
          <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题或摘要"
            className="pl-9 py-2 text-body-sm shadow-none focus:shadow-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="rounded-full px-3">
            最新
          </Button>
          <Button variant="outline" size="sm" className="rounded-full px-3">
            重要度
          </Button>
        </div>
      </div>

      {/* 虚拟滚动文章列表 */}
      <VirtualScroll
        items={virtualScroll.items}
        height={window.innerHeight - 200}
        estimatedItemHeight={180}
        state={virtualScroll.state}
        onLoadMore={() => virtualScroll.loadMore(fetchArticles)}
        onRetry={() => virtualScroll.retry(fetchArticles)}
        emptyState={{
          title: "暂无文章",
          description: "该视图下暂无匹配的文章",
        }}
        errorState={{
          title: "加载失败",
          description: "请稍后重试",
          retryText: "重试",
        }}
        renderItem={(item) => (
          <ArticleListItem
            article={item.data}
            active={selectedArticleId === item.data.id}
            onSelect={() => selectArticle(item.data.id)}
          />
        )}
      />
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
          "flex w-full flex-col gap-2 px-5 py-4 text-left transition-all duration-150",
          active
            ? "border-l-2 border-primary bg-primary/5"
            : "hover:bg-surface-soft",
        )}
      >
        {/* 标题和重要度 */}
        <div className="flex items-start justify-between gap-3">
          <h3
            className={cn(
              "text-[15px] leading-snug",
              unread
                ? "font-medium text-ink-deep"
                : "font-normal text-charcoal",
            )}
          >
            {article.title}
          </h3>
          <Badge variant={importanceVariantMap[article.importance]} size="sm">
            {importanceLabelMap[article.importance]}
          </Badge>
        </div>

        {/* 来源和时间 */}
        <div className="flex items-center gap-2 text-xs text-steel">
          {unread ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-primary"
              aria-label="未读"
            />
          ) : null}
          <span className="truncate font-medium">{article.feedTitle}</span>
          <span aria-hidden className="text-stone">·</span>
          <time dateTime={article.publishedAt} className="text-stone">
            {formatTime(article.publishedAt)}
          </time>
        </div>

        {/* 摘要 */}
        <p className="line-clamp-2 text-sm leading-relaxed text-slate">
          {article.summary}
        </p>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1.5">
          {article.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              {tag}
            </Badge>
          ))}
          {article.tags.length > 2 && (
            <span className="text-xs text-stone">+{article.tags.length - 2}</span>
          )}
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
