"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, RefreshCw, Rss, Trash2, X } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { Empty } from "@/components/retroui/Empty";
import { Input } from "@/components/retroui/Input";
import { AddFeedDialog } from "@/components/feed/add-feed-dialog";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

type ApiFeed = {
  id: number;
  title: string | null;
  url: string;
  folder: string | null;
  fetchInterval: number;
  lastFetchedAt: string | null;
  lastSuccessfulFetchedAt: string | null;
  lastError: string | null;
  unread: number | string | null;
};

type Feed = Omit<ApiFeed, "unread"> & {
  unread: number;
};

/**
 * 订阅源管理。这里使用真实 /api/feeds 数据,不再从 mock/Zustand 读取。
 * 行内编辑标题和分类;删除走行内二次确认,保持低频管理操作的上下文。
 */
export function FeedsSection() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshFeeds = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/feeds", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? payload.error ?? "订阅源加载失败");
      }

      setFeeds((payload.feeds ?? []).map(normalizeFeed));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refreshFeeds);
  }, [refreshFeeds]);

  const groups = useMemo(() => groupByFolder(feeds), [feeds]);
  const folders = useMemo(() => groups.map((g) => g.folder), [groups]);

  async function updateFeed(
    id: number,
    input: { title: string; folder: string | null; fetchInterval: number },
  ) {
    const response = await fetch("/api/feeds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...input }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? payload.error ?? "订阅源保存失败");
    }
    await refreshFeeds();
  }

  async function deleteFeed(id: number) {
    const response = await fetch(`/api/feeds?id=${id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? payload.error ?? "退订失败");
    }
    await refreshFeeds();
  }

  return (
    <section>
      <SectionHeader
        title="订阅源管理"
        desc={`共 ${feeds.length} 个订阅源 · ${groups.length} 个分类`}
        action={
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              title="刷新订阅源"
              onClick={() => void refreshFeeds()}
              disabled={loading}
              className="text-steel hover:text-ink"
            >
              <RefreshCw size={15} className={cn(loading && "animate-spin")} aria-hidden />
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus size={15} aria-hidden />
              添加订阅源
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-body-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && feeds.length === 0 ? (
        <div className="flex items-center gap-2 border border-hairline bg-surface-soft px-4 py-5 text-body-sm text-steel">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          正在加载订阅源
        </div>
      ) : feeds.length === 0 ? (
        <Empty className="gap-4 border border-dashed border-hairline bg-surface-soft py-12 shadow-none hover:shadow-none">
          <Empty.Icon className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/8 text-primary">
            <Rss size={20} aria-hidden />
          </Empty.Icon>
          <div className="flex flex-col gap-1">
            <Empty.Title className="text-body-md-medium">还没有订阅源</Empty.Title>
            <Empty.Description className="text-body-sm text-steel">
              添加第一个 RSS 链接,开始构建你的信息库。
            </Empty.Description>
          </div>
          <Empty.Content>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus size={15} aria-hidden />
              添加订阅源
            </Button>
          </Empty.Content>
        </Empty>
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map(({ folder, items }) => (
            <div key={folder} className="flex flex-col">
              <div className="flex items-center gap-2 pb-1.5">
                <Rss size={12} className="text-stone" aria-hidden />
                <span className="text-micro font-semibold uppercase tracking-wider text-steel">
                  {folder}
                </span>
                <span className="text-micro text-stone">· {items.length}</span>
              </div>
              <ul className="divide-y divide-hairline-soft border-t border-hairline">
                {items.map((feed) => (
                  <FeedRow
                    key={feed.id}
                    feed={feed}
                    folders={folders}
                    onUpdate={updateFeed}
                    onDelete={deleteFeed}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <AddFeedDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void refreshFeeds()}
      />
    </section>
  );
}

function FeedRow({
  feed,
  folders,
  onUpdate,
  onDelete,
}: {
  feed: Feed;
  folders: string[];
  onUpdate: (
    id: number,
    input: { title: string; folder: string | null; fetchInterval: number },
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(feed.title ?? feed.url);
  const [draftFolder, setDraftFolder] = useState(feed.folder ?? "");
  const [draftIntervalMinutes, setDraftIntervalMinutes] = useState(String(Math.round(feed.fetchInterval / 60)));
  const [pending, setPending] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function commit() {
    const title = draftTitle.trim();
    if (!title) return;

    setPending(true);
    setRowError(null);
    try {
      await onUpdate(feed.id, {
        title,
        folder: draftFolder.trim() || null,
        fetchInterval: Math.max(1, Number(draftIntervalMinutes) || 60) * 60,
      });
      setEditing(false);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function cancel() {
    setDraftTitle(feed.title ?? feed.url);
    setDraftFolder(feed.folder ?? "");
    setDraftIntervalMinutes(String(Math.round(feed.fetchInterval / 60)));
    setRowError(null);
    setEditing(false);
  }

  async function remove() {
    setPending(true);
    setRowError(null);
    try {
      await onDelete(feed.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-3 py-3.5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
          <label className="flex flex-col gap-1.5">
            <span className="text-micro font-medium text-steel">名称</span>
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              aria-invalid={!draftTitle.trim() || undefined}
              disabled={pending}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-micro font-medium text-steel">分类</span>
            <Input
              list="settings-folder-options"
              value={draftFolder}
              onChange={(e) => setDraftFolder(e.target.value)}
              placeholder="选择或新建分类"
              className="shadow-none"
              disabled={pending}
            />
            <datalist id="settings-folder-options">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-micro font-medium text-steel">抓取间隔(分钟)</span>
            <Input
              type="number"
              min={1}
              max={1440}
              value={draftIntervalMinutes}
              onChange={(e) => setDraftIntervalMinutes(e.target.value)}
              disabled={pending}
            />
          </label>
        </div>
        {rowError ? <p className="text-micro text-destructive">{rowError}</p> : null}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => void commit()}
            disabled={!draftTitle.trim() || pending}
            className="gap-1.5"
          >
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} disabled={pending} className="gap-1.5">
            <X size={14} aria-hidden />
            取消
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group flex flex-col gap-2 py-3 transition-colors",
        confirming ? "bg-destructive/5" : "hover:bg-surface-soft",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body-sm text-ink">{feed.title ?? feed.url}</span>
          <span className="truncate text-micro text-steel">{feed.url}</span>
          <span className="text-micro text-steel">
            {feed.unread > 0 ? `${feed.unread} 条未读` : "已读完"} · 每 {formatInterval(feed.fetchInterval)} 抓取 · {formatFetchStatus(feed)}
          </span>
          {feed.lastError ? (
            <span className="truncate text-micro text-destructive">最近错误: {feed.lastError}</span>
          ) : null}
        </div>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-micro text-destructive sm:inline">确认退订?</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void remove()}
              disabled={pending}
              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
              退订
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              取消
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              title="编辑"
              onClick={() => {
                setDraftTitle(feed.title ?? feed.url);
                setDraftFolder(feed.folder ?? "");
                setDraftIntervalMinutes(String(Math.round(feed.fetchInterval / 60)));
                setRowError(null);
                setEditing(true);
              }}
              className="text-steel hover:text-ink"
            >
              <Pencil size={15} aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="退订"
              onClick={() => setConfirming(true)}
              className="text-steel hover:text-destructive"
            >
              <Trash2 size={15} aria-hidden />
            </Button>
          </div>
        )}
      </div>
      {rowError ? <p className="text-micro text-destructive">{rowError}</p> : null}
    </li>
  );
}

function normalizeFeed(feed: ApiFeed): Feed {
  return {
    ...feed,
    unread: Number(feed.unread ?? 0),
  };
}

function groupByFolder(feeds: Feed[]) {
  const map = new Map<string, Feed[]>();
  for (const feed of feeds) {
    const key = feed.folder ?? "未分组";
    const list = map.get(key) ?? [];
    list.push(feed);
    map.set(key, list);
  }
  return [...map.entries()].map(([folder, items]) => ({ folder, items }));
}

function formatInterval(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function formatFetchStatus(feed: Feed) {
  if (feed.lastSuccessfulFetchedAt) {
    return `上次成功 ${formatDate(feed.lastSuccessfulFetchedAt)}`;
  }
  if (feed.lastFetchedAt) {
    return `上次抓取 ${formatDate(feed.lastFetchedAt)}`;
  }
  return "尚未抓取";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}