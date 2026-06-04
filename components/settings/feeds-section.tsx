"use client";

import { useMemo, useState } from "react";
import { Plus, Rss, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Empty } from "@/components/retroui/Empty";
import { cn } from "@/lib/utils";
import { useFeedStore } from "@/lib/stores/feed";
import type { MockFeed } from "@/lib/mock/feed";
import { AddFeedDialog } from "@/components/feed/add-feed-dialog";
import { SectionHeader } from "./section-header";

/**
 * 订阅源管理。按分类(folder)分组,divide-y 分隔而非每条一卡 —— 避免卡片滥用。
 * 行内编辑标题 + 切换分类;删除走行内二次确认,不弹独立 modal(单用户、低破坏)。
 * 添加复用既有 AddFeedDialog。
 */
export function FeedsSection() {
  const feeds = useFeedStore((s) => s.feeds);
  const [addOpen, setAddOpen] = useState(false);

  const groups = useMemo(() => groupByFolder(feeds), [feeds]);

  return (
    <section>
      <SectionHeader
        title="订阅源管理"
        desc={`共 ${feeds.length} 个订阅源 · ${groups.length} 个分类`}
        action={
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus size={15} aria-hidden />
            添加订阅源
          </Button>
        }
      />

      {feeds.length === 0 ? (
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
                  <FeedRow key={feed.id} feed={feed} folders={groups.map((g) => g.folder)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <AddFeedDialog open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
}

function FeedRow({ feed, folders }: { feed: MockFeed; folders: string[] }) {
  const updateFeed = useFeedStore((s) => s.updateFeed);
  const removeFeed = useFeedStore((s) => s.removeFeed);

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(feed.title);
  const [draftFolder, setDraftFolder] = useState(feed.folder ?? "");

  function commit() {
    if (!draftTitle.trim()) return;
    updateFeed(feed.id, { title: draftTitle, folder: draftFolder });
    setEditing(false);
  }

  function cancel() {
    setDraftTitle(feed.title);
    setDraftFolder(feed.folder ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-3 py-3.5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-micro font-medium text-steel">名称</span>
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              aria-invalid={!draftTitle.trim() || undefined}
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
            />
            <datalist id="settings-folder-options">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={commit} disabled={!draftTitle.trim()} className="gap-1.5">
            <Check size={14} aria-hidden />
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} className="gap-1.5">
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
        "group flex items-center justify-between gap-3 py-3 transition-colors",
        confirming ? "bg-destructive/5" : "hover:bg-surface-soft",
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-body-sm text-ink">{feed.title}</span>
        <span className="text-micro text-steel">
          {feed.unread > 0 ? `${feed.unread} 条未读` : "已读完"} · 每 1h 抓取
        </span>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-micro text-destructive sm:inline">确认退订?</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => removeFeed(feed.id)}
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} aria-hidden />
            退订
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            取消
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            size="icon"
            variant="ghost"
            title="编辑"
            onClick={() => setEditing(true)}
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
    </li>
  );
}

function groupByFolder(feeds: MockFeed[]) {
  const map = new Map<string, MockFeed[]>();
  for (const feed of feeds) {
    const key = feed.folder ?? "未分组";
    const list = map.get(key) ?? [];
    list.push(feed);
    map.set(key, list);
  }
  return [...map.entries()].map(([folder, items]) => ({ folder, items }));
}
