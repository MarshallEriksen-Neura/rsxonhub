"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { rebuildEmbeddingIndexForCurrentModel } from "@/app/(app)/settings/actions";
import { Button, type IButtonProps } from "@/components/retroui/Button";

type EmbeddingRebuildButtonProps = {
  label?: string;
  pendingLabel?: string;
  onResult?: (result: { ok: boolean; message: string }) => void;
} & Pick<IButtonProps, "className" | "disabled" | "size" | "variant">;

export function EmbeddingRebuildButton({
  label = "重建向量",
  pendingLabel = "入队中",
  onResult,
  disabled,
  size = "sm",
  variant = "outline",
  className,
}: EmbeddingRebuildButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const rebuild = () => {
    startTransition(async () => {
      const toastId = toast.loading("正在创建向量重建任务...");

      try {
        const result = await rebuildEmbeddingIndexForCurrentModel();
        onResult?.({ ok: result.ok, message: result.message });

        if (result.ok) {
          router.refresh();
          toast.success(result.message, { id: toastId });
          return;
        }

        toast.error(result.message, { id: toastId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建向量重建任务失败。";
        onResult?.({ ok: false, message });
        toast.error(message, { id: toastId });
      }
    });
  };

  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled || isPending}
      onClick={rebuild}
      className={className}
    >
      {isPending ? (
        <Loader2 size={14} aria-hidden className="animate-spin" />
      ) : (
        <DatabaseZap size={14} aria-hidden />
      )}
      {isPending ? pendingLabel : label}
    </Button>
  );
}
