"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type IButtonProps } from "@/components/retroui/Button";
import type { EmbeddingRebuildEvent } from "@/lib/ai/embedding-rebuild-events";

type RebuildResult = {
  ok: boolean;
  message: string;
  rebuildRunId?: number;
  progress?: EmbeddingRebuildEvent | null;
};

type StartRebuildResponse =
  | {
      ok: true;
      rebuildRunId: number;
      message: string;
      progress: EmbeddingRebuildEvent | null;
    }
  | {
      ok: false;
      message: string;
    };

type EmbeddingRebuildButtonProps = {
  label?: string;
  pendingLabel?: string;
  onResult?: (result: RebuildResult) => void;
  onProgress?: (progress: EmbeddingRebuildEvent) => void;
} & Pick<IButtonProps, "className" | "disabled" | "size" | "variant">;

export function EmbeddingRebuildButton({
  label = "重建向量",
  pendingLabel = "入队中",
  onResult,
  onProgress,
  disabled,
  size = "sm",
  variant = "outline",
  className,
}: EmbeddingRebuildButtonProps) {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState<EmbeddingRebuildEvent | null>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const rebuild = async () => {
    setIsPending(true);
    setProgress(null);
    eventSourceRef.current?.close();
    const toastId = toast.loading("正在创建向量重建任务...");

    try {
      const response = await fetch("/api/settings/embedding-rebuild", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as StartRebuildResponse;
      onResult?.(result);

      if (!response.ok || !result.ok) {
        toast.error(result.message, { id: toastId });
        return;
      }

      if (result.progress) {
        setProgress(result.progress);
        onProgress?.(result.progress);
      }
      router.refresh();
      toast.loading("向量重建已入队,正在等待 worker 进度...", { id: toastId });
      subscribeToProgress(result.rebuildRunId, toastId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建向量重建任务失败。";
      onResult?.({ ok: false, message });
      toast.error(message, { id: toastId });
    } finally {
      setIsPending(false);
    }
  };

  const subscribeToProgress = (runId: number, toastId: string | number) => {
    const source = new EventSource(`/api/settings/embedding-rebuild/${runId}/events`);
    eventSourceRef.current = source;

    source.addEventListener("progress", (event) => {
      const nextProgress = JSON.parse(event.data) as EmbeddingRebuildEvent;
      setProgress(nextProgress);
      onProgress?.(nextProgress);
    });

    source.addEventListener("done", (event) => {
      const finalProgress = JSON.parse(event.data) as EmbeddingRebuildEvent;
      setProgress(finalProgress);
      onProgress?.(finalProgress);
      source.close();
      eventSourceRef.current = null;
      router.refresh();

      if (finalProgress.status === "complete") {
        toast.success(formatProgressToast(finalProgress), { id: toastId });
      } else {
        toast.error(finalProgress.error ?? "向量重建失败。", { id: toastId });
      }
    });

    source.addEventListener("unavailable", () => {
      source.close();
      eventSourceRef.current = null;
      toast.error("找不到这次向量重建记录。", { id: toastId });
    });

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      toast.error("向量重建已入队,但进度连接中断。刷新页面可查看最新 checkpoint。", {
        id: toastId,
      });
    };
  };

  const isWatching = progress ? !progress.terminal : false;
  const buttonLabel = isPending
    ? pendingLabel
    : progress && !progress.terminal
      ? formatButtonProgress(progress)
      : label;

  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled || isPending || isWatching}
      onClick={rebuild}
      className={className}
    >
      {isPending || isWatching ? (
        <Loader2 size={14} aria-hidden className="animate-spin" />
      ) : (
        <DatabaseZap size={14} aria-hidden />
      )}
      {buttonLabel}
    </Button>
  );
}

function formatButtonProgress(progress: EmbeddingRebuildEvent) {
  const prefix = progress.status === "pending" ? "等待中" : "重建中";
  if (progress.totalArticleCount <= 0) return prefix;
  return `${prefix} ${progress.articleCount}/${progress.totalArticleCount}`;
}

function formatProgressToast(progress: EmbeddingRebuildEvent) {
  return `向量重建完成: ${progress.articleCount}/${progress.totalArticleCount} 篇文章,${progress.chunkCount} chunks。`;
}
