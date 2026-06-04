"use client";

import { Inbox, Circle, Star, Sparkles, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockFeeds, type FeedView } from "@/lib/mock/feed";
import { useFeedStore } from "@/lib/stores/feed";

/**
 * /feed 左栏 · 订阅源侧边栏。
 * 顶部虚拟视图(全部/未读/收藏/精选) + 下方 feeds 列表(按文件夹分组,带未读 badge)。
 */

const VIEWS: { key: FeedView; label: string; icon: typeof Inbox }[] = [
  { key: "all", label: "全部", icon: Inbox },
  { key: "unread", label: "未读", icon: Circle },
  { key: "star", label: "收藏", icon: Star },
  { key: "digest", label: "每日精选", icon: Sparkles },
];

export function FeedsRail() {
  const view = useFeedStore((s) => s.view);
  const setView = useFeedStore((s) => s.setView);
  const selectedFeedId = useFeedStore((s) => s.selectedFeedId);
  const selectFeed = useFeedStore((s) => s.selectFeed);

  const folders = groupByFolder(mockFeeds);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar">
      <ul className="flex flex-col gap-0.5 p-2">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => setView(key)}
              aria-current={view === key ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-body-sm transition-colors",
                view === key
                  ? "bg-accent text-accent-foreground text-body-sm-medium"
                  : "hover:bg-secondary-hover",
              )}
            >
              <Icon size={16} aria-hidden className="shrink-0" />
              {label}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
          订阅源
        </span>
        <button
          type="button"
          title="添加订阅源"
          className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
        >
          <Plus size={15} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-2 pb-4">
        {folders.map(({ folder, feeds }) => (
          <div key={folder} className="flex flex-col gap-0.5">
            <span className="px-3 py-1 text-caption text-muted-foreground">
              {folder}
            </span>
            {feeds.map((feed) => (
              <button
                key={feed.id}
                type="button"
                onClick={() => selectFeed(feed.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-body-sm transition-colors",
                  selectedFeedId === feed.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-secondary-hover",
                )}
              >
                <span className="truncate">{feed.title}</span>
                {feed.unread > 0 ? (
                  <span className="shrink-0 rounded-full bg-secondary px-1.5 text-caption text-muted-foreground">
                    {feed.unread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function groupByFolder(feeds: typeof mockFeeds) {
  const map = new Map<string, typeof mockFeeds>();
  for (const feed of feeds) {
    const key = feed.folder ?? "未分组";
    const list = map.get(key) ?? [];
    list.push(feed);
    map.set(key, list);
  }
  return [...map.entries()].map(([folder, feeds]) => ({ folder, feeds }));
}
