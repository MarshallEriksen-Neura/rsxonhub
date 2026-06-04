"use client";

import { useMemo, useState } from "react";
import { Plus, Check } from "lucide-react";
import { Dialog } from "@/components/retroui/Dialog";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";
import { useFeedStore } from "@/lib/stores/feed";

/**
 * 添加订阅源对话框。
 * 低频轻量操作 → 用 Dialog 而非独立页(批量 OPML 导入再下沉到设置页)。
 *
 * 分类 = subscriptions.folder(自由文本,非独立分类表):
 * 既能从已有分类里选,也能新建,所以用 chips + 新建输入,而不是固定下拉。
 * 添加时必须指定分类 —— 没有"未分组"逃生口,保证侧栏分组结构始终完整。
 */
export function AddFeedDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const feeds = useFeedStore((s) => s.feeds);
  const addFeed = useFeedStore((s) => s.addFeed);
  const selectFeed = useFeedStore((s) => s.selectFeed);

  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    for (const f of feeds) if (f.folder) set.add(f.folder);
    return [...set];
  }, [feeds]);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [touched, setTouched] = useState(false);

  const resolvedFolder = creatingFolder ? newFolder.trim() : folder;
  const urlValid = isLikelyUrl(url);
  const urlError = touched && !urlValid;
  const folderError = touched && resolvedFolder.length === 0;
  const canSubmit = urlValid && resolvedFolder.length > 0;

  function reset() {
    setUrl("");
    setTitle("");
    setFolder("");
    setNewFolder("");
    setCreatingFolder(false);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    const feed = addFeed({ url: url.trim(), title, folder: resolvedFolder });
    selectFeed(feed.id);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content size="md" className="font-sans">
        <Dialog.Header>
          <h2 className="text-body-md-medium">添加订阅源</h2>
        </Dialog.Header>

        <form
          className="flex flex-col gap-5 px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {/* RSS 链接 */}
          <Field label="RSS 链接" required error={urlError ? "请输入有效的 http(s) 链接" : undefined}>
            <Input
              type="url"
              autoFocus
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={urlError || undefined}
            />
          </Field>

          {/* 名称(可选) */}
          <Field label="名称" hint="留空则用站点域名">
            <Input
              placeholder="可选,例如 Hacker News"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          {/* 分类(必填) */}
          <Field
            label="分类"
            required
            error={folderError ? "请选择或新建一个分类" : undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              {existingFolders.map((f) => {
                const active = !creatingFolder && folder === f;
                return (
                  <Button
                    key={f}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => {
                      setFolder(f);
                      setCreatingFolder(false);
                    }}
                    className="gap-1 rounded-full"
                  >
                    {active && <Check size={13} aria-hidden />}
                    {f}
                  </Button>
                );
              })}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setCreatingFolder(true);
                  setFolder("");
                }}
                className={cn(
                  "gap-1 rounded-full border-dashed",
                  creatingFolder && "border-primary text-primary",
                )}
              >
                <Plus size={13} aria-hidden />
                新建分类
              </Button>
            </div>
            {creatingFolder && (
              <Input
                className="mt-2"
                autoFocus
                placeholder="新分类名称,例如 设计"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                aria-invalid={folderError || undefined}
              />
            )}
          </Field>
        </form>

        <Dialog.Footer>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            添加
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-body-sm font-medium text-ink">
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && <span className="font-normal text-steel">· {hint}</span>}
      </span>
      {children}
      {error && <span className="text-micro text-destructive">{error}</span>}
    </label>
  );
}

function isLikelyUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
