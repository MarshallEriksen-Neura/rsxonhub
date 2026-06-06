"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Circle, Star, Plus, Rss } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeedStore, type FeedNavItem, type FeedView } from "@/lib/stores/feed";
import { AddFeedDialog } from "./add-feed-dialog";
import { Button } from "@/components/retroui/Button";

/**
 * /feed 左栏 · 订阅源侧边栏。
 * 改进:
 * - 更清晰的视觉层次和分组
 * - 统一的激活状态样式（左边框 + 背景色）
 * - 更好的间距和过渡动画
 * - 未读徽章使用主题色
 */

const VIEWS: { key: FeedView; label: string; icon: typeof Inbox }[] = [
  { key: "all", label: "全部", icon: Inbox },
  { key: "unread", label: "未读", icon: Circle },
  { key: "star", label: "收藏", icon: Star },
];

export function FeedsRail() {
  const view = useFeedStore((s) => s.view);
  const setView = useFeedStore((s) => s.setView);
  const selectedFeedId = useFeedStore((s) => s.selectedFeedId);
  const selectFeed = useFeedStore((s) => s.selectFeed);
  const feeds = useFeedStore((s) => s.feeds);
  const setFeeds = useFeedStore((s) => s.setFeeds);

  const [addOpen, setAddOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const folders = groupByFolder(feeds);

  const refreshFeeds = useCallback(async () => {
    try {
      const response = await fetch("/api/feeds", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "订阅源加载失败");
      }
      setLoadError(null);
      setFeeds(
        payload.feeds.map((feed: ApiFeed) => ({
          id: feed.id,
          title: feed.title ?? feed.url,
          folder: feed.folder,
          unread: Number(feed.unread ?? 0),
        })),
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [setFeeds]);

  useEffect(() => {
    void Promise.resolve().then(refreshFeeds);
  }, [refreshFeeds]);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-sidebar">
      {/* 顶部虚拟视图 */}
      <div className="flex flex-col gap-0.5 border-b border-hairline p-3">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            onClick={() => setView(key)}
            aria-current={view === key ? "true" : undefined}
            className={cn(
              "w-full justify-start gap-2.5 px-3 py-2 text-body-sm",
              view === key
                ? "border-l-2 border-primary bg-primary/5 text-primary font-medium"
                : "text-charcoal hover:bg-surface hover:text-ink",
            )}
          >
            <Icon size={16} aria-hidden className="shrink-0 opacity-70" />
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>

      {/* 订阅源列表 */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-steel">
            订阅源
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="添加订阅源"
            onClick={() => setAddOpen(true)}
            className="text-steel hover:text-ink"
          >
            <Plus size={14} aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-2 pb-4">
          {loadError ? (
            <div className="px-3 py-2 text-caption text-destructive">
              {loadError}
            </div>
          ) : null}
          {folders.map(({ folder, feeds }) => (
            <div key={folder} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 px-3 py-1">
                <Rss size={12} className="text-stone" aria-hidden />
                <span className="text-xs font-medium text-steel">{folder}</span>
              </div>
              <div className="flex flex-col divide-y divide-hairline-soft">
                {feeds.map((feed) => (
                  <Button
                    key={feed.id}
                    type="button"
                    variant="ghost"
                    onClick={() => selectFeed(feed.id)}
                    className={cn(
                      "w-full justify-between px-3 py-2 text-body-sm",
                      selectedFeedId === feed.id
                        ? "border-l-2 border-primary bg-primary/5 text-primary font-medium"
                        : "text-charcoal hover:bg-surface hover:text-ink",
                    )}
                  >
                    <span className="truncate">{feed.title}</span>
                    {feed.unread > 0 ? (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-micro font-semibold text-primary-foreground">
                        {feed.unread}
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddFeedDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={refreshFeeds}
      />
    </aside>
  );
}

type ApiFeed = {
  id: number;
  title: string | null;
  url: string;
  folder: string | null;
  unread: number | string;
};

function groupByFolder(feeds: FeedNavItem[]) {
  const map = new Map<string, FeedNavItem[]>();
  for (const feed of feeds) {
    const key = feed.folder ?? "未分组";
    const list = map.get(key) ?? [];
    list.push(feed);
    map.set(key, list);
  }
  return [...map.entries()].map(([folder, feeds]) => ({ folder, feeds }));
}
