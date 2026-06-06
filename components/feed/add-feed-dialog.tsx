"use client";

import { useMemo, useState } from "react";
import { Check, FileText, Loader2, Plus, Search } from "lucide-react";
import { Dialog } from "@/components/retroui/Dialog";
import { Input } from "@/components/retroui/Input";
import { Textarea } from "@/components/retroui/Textarea";
import { Button } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";
import { useFeedStore } from "@/lib/stores/feed";
import { toast } from "sonner";

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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void | Promise<void>;
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
  const [mode, setMode] = useState<"single" | "opml">("single");
  const [opmlText, setOpmlText] = useState("");
  const [opmlFolder, setOpmlFolder] = useState("导入");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [opmlImportStatus, setOpmlImportStatus] = useState<OpmlImportStatus>({
    state: "idle",
    message: "选择文件或粘贴 OPML 内容后可以开始导入。",
  });

  const resolvedFolder = creatingFolder ? newFolder.trim() : folder;
  const urlValid = isSupportedSourceUri(url);
  const foloList = isFoloShareListUrl(url);
  const urlError = touched && !urlValid;
  const folderError = touched && resolvedFolder.length === 0;
  const opmlValid = opmlText.trim().length > 0 && opmlFolder.trim().length > 0;
  const opmlError = touched && mode === "opml" && opmlText.trim().length === 0;
  const opmlFolderError = touched && mode === "opml" && opmlFolder.trim().length === 0;
  const canSubmit = mode === "single"
    ? urlValid && resolvedFolder.length > 0
    : opmlValid;
  const opmlSettled = opmlImportStatus.state === "success";

  function reset() {
    setUrl("");
    setTitle("");
    setFolder("");
    setNewFolder("");
    setMode("single");
    setOpmlText("");
    setOpmlFolder("导入");
    setCreatingFolder(false);
    setTouched(false);
    setSubmitting(false);
    setImporting(false);
    setPreviewing(false);
    setPreview(null);
    setOpmlImportStatus({
      state: "idle",
      message: "选择文件或粘贴 OPML 内容后可以开始导入。",
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handlePreview() {
    setTouched(true);
    setPreview(null);
    if (!urlValid) return;

    setPreviewing(true);
    try {
      const response = await fetch("/api/feeds/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUri: url.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "预览订阅源失败");
      }
      setPreview(payload as FeedPreview);
      if (!title.trim() && payload.feed?.title) {
        setTitle(payload.feed.title);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览订阅源失败");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;

    if (mode === "opml") {
      await handleImportOpml();
      return;
    }

    setSubmitting(true);

    try {
      if (foloList) {
        const response = await fetch("/api/feeds/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            foloListUrl: url.trim(),
            folder: resolvedFolder,
          }),
        });
        const payload = (await response.json()) as OpmlImportResult;

        if (!response.ok) {
          throw new Error(payload.message ?? "导入 Folo 分享列表失败");
        }

        const suffix = payload.failedCount > 0 ? `,${payload.failedCount} 个失败` : "";
        await onCreated?.();
        toast.success(`已导入 ${payload.importedCount} 个订阅源${suffix}`);
        handleOpenChange(false);
        return;
      }

      const response = await fetch("/api/feeds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUri: url.trim(),
          title,
          folder: resolvedFolder,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "添加订阅源失败");
      }

      const feed = addFeed({
        id: payload.feed.id,
        url: payload.feed.url,
        title: payload.feed.title ?? title,
        folder: payload.feed.folder,
      });
      selectFeed(feed.id);
      await onCreated?.();
      toast.success("订阅源已添加");
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加订阅源失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImportOpml() {
    setImporting(true);
    setOpmlImportStatus({
      state: "importing",
      message: "已提交 OPML,正在解析并导入订阅源。",
    });

    try {
      const response = await fetch("/api/feeds/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opml: opmlText,
          folder: opmlFolder.trim(),
        }),
      });
      const payload = (await response.json()) as OpmlImportResult;

      if (!response.ok) {
        throw new Error(payload.message ?? "导入 OPML 失败");
      }

      const suffix = payload.failedCount > 0 ? `,${payload.failedCount} 个失败` : "";
      setOpmlImportStatus({
        state: "refreshing",
        message: `服务器已处理完成:成功 ${payload.importedCount} 个${suffix},正在刷新订阅列表。`,
      });
      await onCreated?.();
      setOpmlImportStatus({
        state: "success",
        message: `导入完成:成功 ${payload.importedCount} 个${suffix}。`,
      });
      toast.success(`已导入 ${payload.importedCount} 个订阅源${suffix}`);
      window.setTimeout(() => handleOpenChange(false), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入 OPML 失败";
      setOpmlImportStatus({
        state: "error",
        message,
      });
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  async function handleOpmlFile(file: File | null) {
    if (!file) return;
    setOpmlImportStatus({
      state: "reading",
      message: `正在读取 ${file.name}。`,
    });
    const text = await file.text();
    setOpmlText(text);
    setOpmlImportStatus({
      state: "ready",
      message: `已读取 ${file.name},共 ${text.length.toLocaleString("zh-CN")} 个字符。`,
    });
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
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={mode === "single"}
              icon={<Plus size={14} aria-hidden />}
              label="单个链接"
              onClick={() => setMode("single")}
            />
            <ModeButton
              active={mode === "opml"}
              icon={<FileText size={14} aria-hidden />}
              label="OPML 导入"
              onClick={() => {
                setMode("opml");
                setOpmlImportStatus({
                  state: opmlText.trim() ? "ready" : "idle",
                  message: opmlText.trim()
                    ? "OPML 内容已就绪,可以开始导入。"
                    : "选择文件或粘贴 OPML 内容后可以开始导入。",
                });
              }}
            />
          </div>

          {mode === "single" ? (
            <>
              {/* RSS 链接 */}
              <Field
                label="订阅链接"
                required
                error={urlError ? "请输入有效的 http(s)、rsshub:// 或 Folo 分享列表链接" : undefined}
              >
                <Input
                  type="text"
                  autoFocus
                  placeholder="rsshub://anthropic/research 或 https://app.folo.is/share/lists/..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setPreview(null);
                  }}
                  aria-invalid={urlError || undefined}
                />
              </Field>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePreview()}
                  disabled={!urlValid || foloList || previewing || submitting}
                  className="gap-1.5"
                >
                  {previewing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Search size={14} aria-hidden />}
                  预览
                </Button>
                {foloList ? (
                  <span className="truncate text-micro text-steel">
                    Folo 分享列表会按当前分类批量导入
                  </span>
                ) : null}
                {preview ? (
                  <span className="truncate text-micro text-steel">
                    {preview.feed.title ?? preview.source.canonicalUri} · {preview.feed.itemCount} 条
                  </span>
                ) : null}
              </div>

              {preview ? (
                <div className="rounded-md border border-hairline bg-surface px-3 py-2 text-body-sm text-charcoal">
                  <div className="font-medium text-ink">{preview.feed.title ?? "未命名订阅源"}</div>
                  <div className="mt-1 truncate text-micro text-steel">{preview.source.canonicalUri}</div>
                  {preview.feed.siteUrl ? (
                    <div className="mt-1 truncate text-micro text-steel">{preview.feed.siteUrl}</div>
                  ) : null}
                </div>
              ) : null}

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
                <FolderPicker
                  existingFolders={existingFolders}
                  folder={folder}
                  creatingFolder={creatingFolder}
                  newFolder={newFolder}
                  folderError={folderError}
                  onSelectFolder={(value) => {
                    setFolder(value);
                    setCreatingFolder(false);
                  }}
                  onCreateFolder={() => {
                    setCreatingFolder(true);
                    setFolder("");
                  }}
                  onNewFolderChange={setNewFolder}
                />
              </Field>
            </>
          ) : (
            <>
              <Field
                label="OPML 文件"
                required
                hint="支持 .opml / .xml"
                error={opmlError ? "请选择文件或粘贴 OPML 内容" : undefined}
              >
                <Input
                  type="file"
                  accept=".opml,.xml,text/xml,application/xml"
                  onChange={(e) => void handleOpmlFile(e.target.files?.[0] ?? null)}
                  aria-invalid={opmlError || undefined}
                  disabled={importing}
                />
              </Field>

              <Field label="OPML 内容">
                <Textarea
                  placeholder="<opml>...</opml>"
                  value={opmlText}
                  onChange={(e) => {
                    setOpmlText(e.target.value);
                    setOpmlImportStatus({
                      state: e.target.value.trim() ? "ready" : "idle",
                      message: e.target.value.trim()
                        ? "OPML 内容已就绪,可以开始导入。"
                        : "选择文件或粘贴 OPML 内容后可以开始导入。",
                    });
                  }}
                  disabled={importing}
                  className={cn("min-h-36 font-mono text-micro", opmlError && "border-destructive")}
                />
              </Field>

              <Field
                label="默认分类"
                required
                hint="OPML 没有父级分类时使用"
                error={opmlFolderError ? "请输入默认分类" : undefined}
              >
                <Input
                  placeholder="导入"
                  value={opmlFolder}
                  onChange={(e) => setOpmlFolder(e.target.value)}
                  aria-invalid={opmlFolderError || undefined}
                  disabled={importing}
                />
              </Field>

              <OpmlImportFeedback status={opmlImportStatus} />
            </>
          )}
        </form>

        <Dialog.Footer>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={importing}>
            取消
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit || submitting || importing || opmlSettled}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            {mode === "opml" && importing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            {mode === "opml" ? (importing ? "导入中" : "导入") : submitting ? "处理中" : foloList ? "导入" : "添加"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-body-sm transition-colors",
        active
          ? "border-primary/50 bg-primary/8 text-ink"
          : "border-hairline bg-surface text-charcoal hover:border-primary/30",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function FolderPicker({
  existingFolders,
  folder,
  creatingFolder,
  newFolder,
  folderError,
  onSelectFolder,
  onCreateFolder,
  onNewFolderChange,
}: {
  existingFolders: string[];
  folder: string;
  creatingFolder: boolean;
  newFolder: string;
  folderError: boolean;
  onSelectFolder: (folder: string) => void;
  onCreateFolder: () => void;
  onNewFolderChange: (folder: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {existingFolders.map((f) => {
          const active = !creatingFolder && folder === f;
          return (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onSelectFolder(f)}
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
          onClick={onCreateFolder}
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
          onChange={(e) => onNewFolderChange(e.target.value)}
          aria-invalid={folderError || undefined}
        />
      )}
    </>
  );
}

function OpmlImportFeedback({ status }: { status: OpmlImportStatus }) {
  const busy = status.state === "reading" || status.state === "importing" || status.state === "refreshing";
  const success = status.state === "success";
  const error = status.state === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 border px-3 py-2 text-body-sm",
        error
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : success
            ? "border-primary/30 bg-primary/8 text-primary"
            : "border-hairline bg-surface-soft text-steel",
      )}
    >
      {busy ? (
        <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin" aria-hidden />
      ) : success ? (
        <Check size={15} className="mt-0.5 shrink-0" aria-hidden />
      ) : (
        <FileText size={15} className="mt-0.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0">{status.message}</span>
    </div>
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

type FeedPreview = {
  source: {
    type: "rsshub" | "http";
    canonicalUri: string;
    fetchUrl: string;
    route?: string;
  };
  feed: {
    title: string | null;
    siteUrl: string | null;
    itemCount: number;
  };
};

type OpmlImportResult = {
  message?: string;
  importedCount: number;
  failedCount: number;
};

type OpmlImportStatus = {
  state: "idle" | "reading" | "ready" | "importing" | "refreshing" | "success" | "error";
  message: string;
};

function isSupportedSourceUri(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("rsshub://")) {
    return v.length > "rsshub://".length;
  }

  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isFoloShareListUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      u.hostname === "app.folo.is" &&
      /^\/share\/lists\/\d+\/?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}
