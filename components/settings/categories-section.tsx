"use client";

import { useMemo, useState } from "react";
import { FolderTree, Pencil, Trash2, Check, X, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Empty } from "@/components/retroui/Empty";
import { cn } from "@/lib/utils";
import { useFeedStore } from "@/lib/stores/feed";
import { SectionHeader } from "./section-header";
import { AddCategoryDialog } from "./add-category-dialog";

/**
 * 分类管理。分类 = subscriptions.folder(自由文本,非独立表),
 * 列表 = 有源分类(从 feeds 聚合)+ 空壳分类(store.folders,用户显式新建、暂无源)。
 * 新建 = 写入空壳;重命名 = 批量迁移该 folder 下的源;
 * 删除 = 级联退订其下全部源(危险,二次确认)。
 */
export function CategoriesSection() {
  const feeds = useFeedStore((s) => s.feeds);
  const emptyFolders = useFeedStore((s) => s.folders);
  const [addOpen, setAddOpen] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    // 先放空壳分类(计数 0),有源分类再覆盖/累加
    for (const name of emptyFolders) if (!map.has(name)) map.set(name, 0);
    for (const f of feeds) {
      const key = f.folder ?? "未分组";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [feeds, emptyFolders]);

  return (
    <section>
      <SectionHeader
        title="分类管理"
        desc={`${categories.length} 个分类 · 重命名会同步迁移其下订阅源`}
        action={
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus size={15} aria-hidden />
            添加分类
          </Button>
        }
      />

      {categories.length === 0 ? (
        <Empty className="gap-4 border border-dashed border-hairline bg-surface-soft py-12 shadow-none hover:shadow-none">
          <Empty.Icon className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/8 text-primary">
            <FolderTree size={20} aria-hidden />
          </Empty.Icon>
          <div className="flex flex-col gap-1">
            <Empty.Title className="text-body-md-medium">还没有分类</Empty.Title>
            <Empty.Description className="text-body-sm text-steel">
              新建一个分类,或在添加订阅源时指定分类。
            </Empty.Description>
          </div>
          <Empty.Content>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus size={15} aria-hidden />
              添加分类
            </Button>
          </Empty.Content>
        </Empty>
      ) : (
        <ul className="divide-y divide-hairline-soft border-t border-hairline">
          {categories.map((cat) => (
            <CategoryRow
              key={cat.name}
              name={cat.name}
              count={cat.count}
              existing={categories.map((c) => c.name)}
            />
          ))}
        </ul>
      )}

      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
}

function CategoryRow({
  name,
  count,
  existing,
}: {
  name: string;
  count: number;
  existing: string[];
}) {
  const renameFolder = useFeedStore((s) => s.renameFolder);
  const deleteFolder = useFeedStore((s) => s.deleteFolder);

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(name);

  const trimmed = draft.trim();
  const collides = trimmed !== name && existing.includes(trimmed);
  const canSave = trimmed.length > 0 && !collides;
  const isUngrouped = name === "未分组";

  function commit() {
    if (!canSave) return;
    renameFolder(name, trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3.5">
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={collides || undefined}
            className="max-w-xs"
          />
          <Button size="sm" onClick={commit} disabled={!canSave} className="gap-1.5">
            <Check size={14} aria-hidden />
            保存
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(name);
              setEditing(false);
            }}
            className="gap-1.5"
          >
            <X size={14} aria-hidden />
            取消
          </Button>
        </div>
        {collides && (
          <span className="text-micro text-destructive">
            已存在同名分类「{trimmed}」—— 保存将合并两者。
          </span>
        )}
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
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-steel">
          <FolderTree size={15} aria-hidden />
        </span>
        <span className="truncate text-body-sm text-ink">{name}</span>
        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-micro font-medium text-steel">
          {count} 源
        </span>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 text-micro text-destructive sm:flex">
            <AlertTriangle size={13} aria-hidden />
            连同 {count} 个源一起删除?
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteFolder(name)}
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} aria-hidden />
            删除
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
            title={isUngrouped ? "「未分组」不可重命名" : "重命名"}
            disabled={isUngrouped}
            onClick={() => setEditing(true)}
            className="text-steel hover:text-ink"
          >
            <Pencil size={15} aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="删除分类"
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
