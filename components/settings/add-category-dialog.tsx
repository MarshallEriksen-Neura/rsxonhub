"use client";

import { useMemo, useState } from "react";
import { FolderPlus } from "lucide-react";
import { Dialog } from "@/components/retroui/Dialog";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { useFeedStore } from "@/lib/stores/feed";

/**
 * 新建分类对话框。分类 = subscriptions.folder(自由文本),
 * 这里建的是"空壳"分类(暂无源),记在 store.folders,之后可在添加/编辑订阅源时选中。
 * 与既有分类(含已有源的)重名则拒绝,避免聚合时产生歧义。
 */
export function AddCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const feeds = useFeedStore((s) => s.feeds);
  const folders = useFeedStore((s) => s.folders);
  const addFolder = useFeedStore((s) => s.addFolder);

  const existing = useMemo(() => {
    const set = new Set<string>(folders);
    for (const f of feeds) if (f.folder) set.add(f.folder);
    return set;
  }, [feeds, folders]);

  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const collides = existing.has(trimmed);
  const empty = trimmed.length === 0;
  const error = touched && (empty || collides);
  const canSubmit = !empty && !collides;

  function reset() {
    setName("");
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    addFolder(trimmed);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content size="sm" className="font-sans">
        <Dialog.Header>
          <h2 className="text-body-md-medium">新建分类</h2>
        </Dialog.Header>

        <form
          className="flex flex-col gap-5 px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-body-sm font-medium text-ink">
              分类名称
              <span className="text-destructive">*</span>
            </span>
            <Input
              autoFocus
              placeholder="例如 设计、播客、长读"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error || undefined}
            />
            {error && (
              <span className="text-micro text-destructive">
                {empty ? "请输入分类名称" : `已存在分类「${trimmed}」`}
              </span>
            )}
            {!error && (
              <span className="text-micro text-steel">
                建好后可在添加 / 编辑订阅源时选用
              </span>
            )}
          </label>
        </form>

        <Dialog.Footer>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit} className="gap-1.5">
            <FolderPlus size={15} aria-hidden />
            新建
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
