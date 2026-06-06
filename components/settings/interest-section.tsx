"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Database, Loader2, Target } from "lucide-react";
import {
  rebuildEmbeddingIndexForCurrentModel,
  saveInterestProfileSettings,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/retroui/Button";
import { Textarea } from "@/components/retroui/Textarea";
import { cn } from "@/lib/utils";
import type { ActiveInterestProfile } from "@/lib/interests/profile";
import { SectionHeader } from "./section-header";

export function InterestSection({
  initialProfile,
}: {
  initialProfile: ActiveInterestProfile | null;
}) {
  const [content, setContent] = useState(initialProfile?.content ?? "");
  const [version, setVersion] = useState(initialProfile?.version ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRebuild, setPendingRebuild] = useState<{
    message: string;
    probedDimension: number;
    expectedDimension: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = content.trim() !== (initialProfile?.content ?? "").trim();
  const canSave = content.trim().length > 0 && !isPending;

  function save() {
    startTransition(async () => {
      const result = await saveInterestProfileSettings({ content });
      if (!result.ok) {
        if ("kind" in result && result.kind === "embedding-rebuild-required") {
          setPendingRebuild({
            message: result.message,
            probedDimension: result.probedDimension,
            expectedDimension: result.expectedDimension,
          });
          setError(null);
          setNotice(null);
          return;
        }
        setError(result.message);
        setNotice(null);
        return;
      }

      setVersion(result.version);
      setError(null);
      setPendingRebuild(null);
      setNotice(result.message);
    });
  }

  function rebuildIndex() {
    startTransition(async () => {
      const result = await rebuildEmbeddingIndexForCurrentModel();
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setPendingRebuild(null);
      setError(null);
      setNotice(result.message);
    });
  }

  return (
    <section>
      <SectionHeader
        title="兴趣画像"
        desc="用自然语言描述你希望系统优先关注的信息；检索候选由它驱动，工程代码只做预算和排序。"
        action={
          <Button size="sm" disabled={!canSave || !dirty} onClick={save} className="gap-1.5">
            {isPending ? (
              <Loader2 size={15} aria-hidden className="animate-spin" />
            ) : (
              <Check size={15} aria-hidden />
            )}
            保存画像
          </Button>
        }
      />

      {(notice || error) && (
        <div
          className={cn(
            "mb-5 flex items-center gap-2 rounded-md border px-3 py-2 text-body-sm",
            error
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-hairline bg-surface text-charcoal",
          )}
        >
          <AlertCircle size={15} aria-hidden />
          <span>{error ?? notice}</span>
        </div>
      )}

      {pendingRebuild ? (
        <div className="mb-5 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-body-sm text-charcoal">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <Database size={15} aria-hidden />
            需要重建向量索引
          </div>
          <p>{pendingRebuild.message}</p>
          <div className="text-micro text-steel">
            当前索引维度 {pendingRebuild.expectedDimension} · 当前模型维度 {pendingRebuild.probedDimension}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={rebuildIndex} disabled={isPending} className="gap-1.5">
              {isPending ? (
                <Loader2 size={14} aria-hidden className="animate-spin" />
              ) : (
                <Database size={14} aria-hidden />
              )}
              重建向量索引
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingRebuild(null)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-hairline bg-background">
        <div className="flex items-start gap-3 border-b border-hairline p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Target size={17} aria-hidden />
          </span>
          <div>
            <h3 className="text-body font-medium text-ink">日报候选选择输入</h3>
            <p className="mt-1 text-body-sm text-steel">
              保存后会生成当前候选集，并只为候选文章入队 AI 摘要任务。
            </p>
          </div>
          {version ? (
            <span className="ml-auto rounded-md bg-surface px-2 py-1 text-micro text-steel">
              v{version}
            </span>
          ) : null}
        </div>

        <div className="p-5">
          <Textarea
            value={content}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
              setContent(event.target.value);
              setNotice(null);
              setError(null);
              setPendingRebuild(null);
            }}
            rows={12}
            placeholder="例如：我关注 AI agent、开源基础设施、RSS/RAG 产品设计、模型推理成本、开发者工具，以及与个人知识管理相关的高质量研究或实践。"
            className="min-h-72 resize-y bg-surface-soft text-body-sm leading-relaxed"
          />
          <div className="mt-3 text-micro text-steel">
            当前 {content.trim().length} 字。建议写清主题、排除项、优先级和你偏好的文章类型。
          </div>
        </div>
      </div>
    </section>
  );
}
