"use client";

import { RefreshCw, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Importance } from "@/lib/mock/feed";
import { useFeedStore } from "@/lib/stores/feed";
import { Badge } from "@/components/retroui/Badge";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { VirtualScroll, useVirtualScroll } from "./virtual-scroll";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// 重要性徽章变体配置
const importanceVariantMap: Record<Importance, "outline" | "surface" | "default"> = {
  high: "outline",
  medium: "surface",
  low: "default",
  unknown: "default",
};

const importanceLabelMap: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
  unknown: "未评",
};

type ArticleSort = "latest" | "importance";

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
  const selectedFeedId = useFeedStore((s) => s.selectedFeedId);
  const selectedArticleId = useFeedStore((s) => s.selectedArticleId);
  const selectArticle = useFeedStore((s) => s.selectArticle);
  const setFeeds = useFeedStore((s) => s.setFeeds);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<ArticleSort>("latest");

  // 使用虚拟滚动 Hook
  const {
    items,
    state,
    loadInitial,
    loadMore,
    retry,
  } = useVirtualScroll<ArticleView>();
  
  const fetchArticles = useCallback(async (
    _page: number,
    size: number,
    cursor?: string | null,
  ) => {
    const params = new URLSearchParams({
      view,
      limit: String(size),
      sort,
    });
    if (cursor) params.set("cursor", cursor);
    if (selectedFeedId) params.set("feedId", String(selectedFeedId));
    if (search.trim()) params.set("search", search.trim());

    const response = await fetch(`/api/articles?${params}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "文章加载失败");
    }

    return {
      data: payload.articles as ArticleView[],
      hasMore: Boolean(payload.pagination?.hasMore),
      nextCursor: payload.pagination?.nextCursor ?? null,
    };
  }, [search, selectedFeedId, sort, view]);
  
  // 当 view 或 search 变化时重新加载
  useEffect(() => {
    void loadInitial(fetchArticles);
  }, [fetchArticles, loadInitial]);

  async function refreshFeedsSnapshot() {
    const response = await fetch("/api/feeds", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "订阅源加载失败");
    }
    setFeeds(
      payload.feeds.map((feed: ApiFeed) => ({
        id: feed.id,
        title: feed.title ?? feed.url,
        folder: feed.folder,
        unread: Number(feed.unread ?? 0),
      })),
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedFeedId ? { feedId: selectedFeedId } : {}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "刷新订阅源失败");
      }
      await refreshFeedsSnapshot();
      await loadInitial(fetchArticles);
      toast.success("订阅源刷新完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新订阅源失败");
    } finally {
      setRefreshing(false);
    }
  }

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sort === "latest" ? "default" : "outline"}
              size="sm"
              aria-pressed={sort === "latest"}
              onClick={() => setSort("latest")}
              className="rounded-full px-3"
            >
              最新
            </Button>
            <Button
              type="button"
              variant={sort === "importance" ? "default" : "outline"}
              size="sm"
              aria-pressed={sort === "importance"}
              onClick={() => setSort("importance")}
              className="rounded-full px-3"
            >
              重要度
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={selectedFeedId ? "抓取当前订阅源" : "抓取全部订阅源"}
            aria-label={selectedFeedId ? "抓取当前订阅源" : "抓取全部订阅源"}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="shrink-0 rounded-full"
          >
            <RefreshCw
              size={15}
              aria-hidden
              className={cn(refreshing && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* 虚拟滚动文章列表 */}
      <VirtualScroll
        items={items}
        height={0}
        estimatedItemHeight={180}
        state={state}
        onLoadMore={() => loadMore(fetchArticles)}
        onRetry={() => retry(fetchArticles)}
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

async function updateArticleStatus(
  articleId: number,
  status: ArticleView["status"],
) {
  await fetch("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articleId, status }),
  });
}

function ArticleListItem({
  article,
  active,
  onSelect,
}: {
  article: ArticleView;
  active: boolean;
  onSelect: () => void;
}) {
  const [localStatus, setLocalStatus] = useState(article.status);
  const unread = localStatus === "unread";
  const starred = localStatus === "star";

  const handleClick = async () => {
    if (unread) {
      setLocalStatus("read");
      try {
        await updateArticleStatus(article.id, "read");
      } catch {
        setLocalStatus("unread");
      }
    }
    onSelect();
  };

  const handleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = starred ? "read" : "star";
    setLocalStatus(next);
    try {
      await updateArticleStatus(article.id, next);
    } catch {
      setLocalStatus(localStatus);
    }
  };

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={handleClick}
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
          <Badge
            variant={importanceVariantMap[article.importance]}
            size="sm"
            className={cn(article.importance === "unknown" && "opacity-60")}
          >
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

      {/* 收藏按钮 */}
      <button
        type="button"
        onClick={handleStar}
        aria-label={starred ? "取消收藏" : "收藏"}
        className={cn(
          "absolute right-3 top-4 rounded p-1 transition-opacity",
          starred
            ? "opacity-100 text-amber-400"
            : "opacity-0 group-hover:opacity-100 text-stone hover:text-amber-400",
        )}
      >
        <Star size={15} fill={starred ? "currentColor" : "none"} aria-hidden />
      </button>
    </li>
  );
}

export type ArticleView = {
  id: number;
  feedId: number;
  feedTitle: string;
  title: string | null;
  url: string | null;
  author: string | null;
  publishedAt: string;
  imageUrl: string | null;
  summary: string;
  summaryStatus: "pending" | "complete" | "failed" | null;
  summaryError: string | null;
  bullets: string[];
  tags: string[];
  importance: Importance;
  status: "unread" | "read" | "star" | "later";
  content: string;
};

type ApiFeed = {
  id: number;
  url: string;
  title: string | null;
  folder: string | null;
  unread: number | string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
