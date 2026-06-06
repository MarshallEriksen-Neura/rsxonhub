"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BrainCircuit,
  Check,
  Database,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MessageSquare,
  Search,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchAIModels,
  saveAISettings,
  testAIConnection,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Switch } from "@/components/retroui/Switch";
import { maskSecret } from "@/lib/ai/mask";
import type { PublicAIConfigSnapshot } from "@/lib/ai/config";
import type {
  AIModelCapability,
  AIModelPresetSnapshot,
} from "@/lib/ai/model-presets";
import { cn } from "@/lib/utils";
import { EmbeddingRebuildButton } from "./embedding-rebuild-button";
import { SectionHeader } from "./section-header";

type AISectionProps = {
  initialConfig: PublicAIConfigSnapshot;
  initialModelPresets: AIModelPresetSnapshot;
  latestRebuild: {
    id: number;
    status: string;
    model: string;
    baseUrl: string;
    dimension: number;
    articleCount: number;
    chunkCount: number;
    jobId: string | null;
    totalArticleCount: number;
    lastProcessedArticleId: number;
    lastProcessedAt: string | null;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
  } | null;
};

type ChatDraft = {
  baseUrl: string;
  apiKey: string;
  model: string;
  chatApiMode: "chat_completions" | "responses";
  temperature: number;
};

type EmbeddingDraft = {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
};

type ModelItem = {
  id: string;
  name: string;
  supportsChat: boolean;
  supportsEmbedding: boolean;
  selectedChat: boolean;
  selectedEmbedding: boolean;
};

export function AISection({
  initialConfig,
  initialModelPresets,
  latestRebuild,
}: AISectionProps) {
  const router = useRouter();
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [chat, setChat] = useState<ChatDraft>(() => ({
    baseUrl: initialConfig.chat.baseUrl,
    apiKey: "",
    model: initialConfig.chat.model,
    chatApiMode: initialConfig.chat.chatApiMode,
    temperature: initialConfig.chat.temperature,
  }));
  const [embedding, setEmbedding] = useState<EmbeddingDraft>(() => ({
    baseUrl: initialConfig.embedding.baseUrl,
    apiKey: "",
    model: initialConfig.embedding.model,
    dimension: initialConfig.embedding.dimension,
  }));
  const [chatModels, setChatModels] = useState<AIModelCapability[]>(
    initialModelPresets.chat,
  );
  const [embeddingModels, setEmbeddingModels] = useState<AIModelCapability[]>(
    initialModelPresets.embedding,
  );
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveKind, setSaveKind] = useState<"save" | "rebuild" | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [modelFetchKind, setModelFetchKind] = useState<"chat" | "embedding" | null>(null);
  const [testKind, setTestKind] = useState<"chat" | "embedding" | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<"all" | "chat" | "embedding">("all");
  const [pendingRebuild, setPendingRebuild] = useState<{
    message: string;
    existingChunkCount: number;
    probedDimension: number;
    expectedDimension: number;
  } | null>(null);

  const modelItems = useMemo<ModelItem[]>(() => {
    return mergeModelCapabilities([
      capabilityForModel(chat.model, "chat"),
      capabilityForModel(savedConfig.chat.model, "chat"),
      capabilityForModel(embedding.model, "embedding"),
      capabilityForModel(savedConfig.embedding.model, "embedding"),
      ...chatModels,
      ...embeddingModels,
    ]).map((model) => ({
      id: model.model,
      name: model.model,
      supportsChat: model.supportsChat,
      supportsEmbedding: model.supportsEmbedding,
      selectedChat: model.model === chat.model,
      selectedEmbedding: model.model === embedding.model,
    }));
  }, [
    chat.model,
    chatModels,
    embedding.model,
    embeddingModels,
    savedConfig.chat.model,
    savedConfig.embedding.model,
  ]);

  const filteredModels = modelItems.filter((model) => {
    const matchSearch = model.name.toLowerCase().includes(modelSearch.toLowerCase());
    const matchFilter =
      modelFilter === "all" ||
      (modelFilter === "chat" && model.supportsChat) ||
      (modelFilter === "embedding" && model.supportsEmbedding);
    return matchSearch && matchFilter;
  });

  const updateChat = (patch: Partial<ChatDraft>) => {
    setChat((current) => ({ ...current, ...patch }));
    markDirty();
  };

  const updateEmbedding = (patch: Partial<EmbeddingDraft>) => {
    setEmbedding((current) => ({ ...current, ...patch }));
    markDirty();
  };

  const markDirty = () => {
    setDirty(true);
  };

  const selectModel = (model: ModelItem) => {
    if (modelFilter === "chat" && model.supportsChat) {
      updateChat({ model: model.name });
      return;
    }

    if (modelFilter === "embedding" && model.supportsEmbedding) {
      updateEmbedding({ model: model.name });
      return;
    }

    if (model.supportsChat && !model.supportsEmbedding) {
      updateChat({ model: model.name });
      return;
    }

    if (model.supportsEmbedding && !model.supportsChat) {
      updateEmbedding({ model: model.name });
      return;
    }

    updateChat({ model: model.name });
  };

  const testConnection = (kind: "chat" | "embedding") => {
    const config = kind === "chat" ? chat : embedding;
    setTestKind(kind);
    startTransition(async () => {
      const toastId = toast.loading(
        kind === "chat" ? "正在测试对话模型..." : "正在测试向量模型...",
      );
      try {
        const result = await testAIConnection({
          kind,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          ...(kind === "chat" ? { chatApiMode: chat.chatApiMode } : {}),
        });
        if (result.ok) {
          toast.success(result.message, { id: toastId });
        } else {
          toast.error(result.message, { id: toastId });
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "连接测试失败。", {
          id: toastId,
        });
      } finally {
        setTestKind(null);
      }
    });
  };

  const refreshModels = (kind: "chat" | "embedding") => {
    setModelFetchKind(kind);

    startTransition(async () => {
      const config = kind === "chat" ? chat : embedding;
      const result = await fetchAIModels({
        kind,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });

      setModelFetchKind(null);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      if (result.kind === "chat") {
        setChatModels(result.models);
        setModelFilter("chat");
      } else {
        setEmbeddingModels(result.models);
        setModelFilter("embedding");
      }

      toast.success(result.message);
    });
  };

  const save = (confirmEmbeddingRebuild = false) => {
    setSaveKind(confirmEmbeddingRebuild ? "rebuild" : "save");
    setStatusMessage({
      tone: "info",
      message: confirmEmbeddingRebuild
        ? "正在保存 AI 配置并创建向量重建任务..."
        : "正在保存 AI 配置...",
    });

    startTransition(async () => {
      try {
        const result = await saveAISettings({
          chat,
          embedding,
          confirmEmbeddingRebuild,
        });

        if (!result.ok) {
          if ("kind" in result && result.kind === "embedding-rebuild-required") {
            setPendingRebuild({
              message: result.message,
              existingChunkCount: result.existingChunkCount,
              probedDimension: result.probedDimension,
              expectedDimension: result.expectedDimension,
            });
            setStatusMessage(null);
            return;
          }
          setStatusMessage({ tone: "error", message: result.message });
          toast.error(result.message);
          return;
        }

        setSavedConfig(result.config);
        setChat((current) => ({
          ...current,
          apiKey: "",
          baseUrl: result.config.chat.baseUrl,
          model: result.config.chat.model,
          chatApiMode: result.config.chat.chatApiMode,
          temperature: result.config.chat.temperature,
        }));
        setEmbedding((current) => ({
          ...current,
          apiKey: "",
          baseUrl: result.config.embedding.baseUrl,
          model: result.config.embedding.model,
          dimension: result.config.embedding.dimension,
        }));
        setChatModels((current) =>
          mergeModelCapabilities([
            capabilityForModel(result.config.chat.model, "chat"),
            ...current,
          ]),
        );
        setEmbeddingModels((current) =>
          mergeModelCapabilities([
            capabilityForModel(result.config.embedding.model, "embedding"),
            ...current,
          ]),
        );
        setDirty(false);
        setPendingRebuild(null);
        setStatusMessage({ tone: "success", message: result.message });
        router.refresh();
        toast.success(result.message);
      } finally {
        setSaveKind(null);
      }
    });
  };

  return (
    <section>
      <SectionHeader
        title="AI 配置"
        desc="配置系统默认对话模型与向量模型"
        action={
          <Button
            size="sm"
            disabled={!dirty || isPending}
            onClick={() => save(false)}
            className="gap-1.5"
          >
            {saveKind === "save" ? (
              <Loader2 size={15} aria-hidden className="animate-spin" />
            ) : (
              <Check size={15} aria-hidden />
            )}
            {dirty ? "保存更改" : "已保存"}
          </Button>
        }
      />


      {statusMessage ? (
        <div
          role="status"
          className={cn(
            "mb-5 flex items-center gap-2 rounded-md border px-3 py-2 text-body-sm",
            statusMessage.tone === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : statusMessage.tone === "success"
                ? "border-primary/30 bg-primary/8 text-charcoal"
                : "border-hairline bg-surface text-charcoal",
          )}
        >
          {statusMessage.tone === "info" ? (
            <Loader2 size={15} aria-hidden className="animate-spin" />
          ) : statusMessage.tone === "success" ? (
            <Check size={15} aria-hidden />
          ) : (
            <AlertCircle size={15} aria-hidden />
          )}
          <span>{statusMessage.message}</span>
        </div>
      ) : null}

      {pendingRebuild ? (
        <div className="mb-5 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-body-sm text-charcoal">
          <div className="font-medium text-destructive">需要重建向量索引</div>
          <p>{pendingRebuild.message}</p>
          <div className="text-micro text-steel">
            现有 {pendingRebuild.existingChunkCount} 个 chunks · 新模型维度 {pendingRebuild.probedDimension} · 当前索引维度 {pendingRebuild.expectedDimension}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save(true)} disabled={isPending} className="gap-1.5">
              {saveKind === "rebuild" ? (
                <Loader2 size={14} aria-hidden className="animate-spin" />
              ) : (
                <Database size={14} aria-hidden />
              )}
              {saveKind === "rebuild" ? "保存并入队中" : "保存并重建向量"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setPendingRebuild(null)}
            >
              取消
            </Button>
          </div>
        </div>
      ) : null}

      {latestRebuild ? (
        <div className="mb-5 rounded-md border border-hairline bg-surface px-4 py-3 text-body-sm text-charcoal">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-ink">最近向量重建 #{latestRebuild.id}</div>
            <div className="flex items-center gap-2">
              <EmbeddingRebuildButton
                disabled={isPending}
                className="gap-1.5"
                onResult={(result) =>
                  setStatusMessage({
                    tone: result.ok ? "success" : "error",
                    message: result.message,
                  })
                }
              />
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-micro font-medium",
                  latestRebuild.status === "failed"
                    ? "bg-destructive/10 text-destructive"
                    : latestRebuild.status === "complete"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-steel",
                )}
              >
                {latestRebuild.status}
              </span>
            </div>
          </div>
          <div className="mt-2 text-micro text-steel">
            {latestRebuild.model} · {formatRebuildArticleProgress(latestRebuild)} · {latestRebuild.chunkCount} chunks
          </div>
          {latestRebuild.status === "pending" || latestRebuild.status === "running" ? (
            <div className="mt-2 rounded-md border border-hairline bg-canvas px-3 py-2 text-micro text-steel">
              {latestRebuild.status === "running"
                ? `checkpoint article #${latestRebuild.lastProcessedArticleId}${latestRebuild.lastProcessedAt ? ` · ${new Date(latestRebuild.lastProcessedAt).toLocaleString("zh-CN")}` : ""}`
                : latestRebuild.jobId
                ? `job ${latestRebuild.jobId} 已写入队列,等待后台 worker 接手。`
                : "这条记录还没有绑定 jobId,属于旧记录或入队未完成状态。"}
            </div>
          ) : null}
          {latestRebuild.error ? (
            <div className="mt-1 text-micro text-destructive">{latestRebuild.error}</div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-5">
          <RuntimePanel
            title="默认对话模型"
            desc="聊天、摘要、日报筛选等文本生成任务会从这里读取"
            icon={MessageSquare}
            active={savedConfig.chat.apiKeyConfigured}
            tooltip="仅支持 OpenAI 兼容格式的模型（OpenAI-compatible API）"
          >
            <Field label="API Key">
              <KeyField
                configured={savedConfig.chat.apiKeyConfigured}
                masked={savedConfig.chat.apiKeyMasked}
                value={chat.apiKey}
                onChange={(apiKey) => updateChat({ apiKey })}
              />
            </Field>

            <Field label="OpenAI 兼容 Base URL" hint="必须包含 http(s)://">
              <Input
                value={chat.baseUrl}
                onChange={(event) => updateChat({ baseUrl: event.target.value })}
                placeholder="https://integrate.api.nvidia.com/v1"
              />
            </Field>

            <Field label="默认对话模型">
              <Input
                value={chat.model}
                onChange={(event) => updateChat({ model: event.target.value })}
                placeholder="deepseek-ai/deepseek-v3.1"
                className="font-mono"
              />
            </Field>

            <Field
              label="对话接口模式"
              hint="OpenAI 兼容服务通常选 Chat Completions"
            >
              <SegmentedControl
                value={chat.chatApiMode}
                options={[
                  {
                    value: "chat_completions",
                    label: "Chat Completions",
                    description: "/v1/chat/completions",
                  },
                  {
                    value: "responses",
                    label: "Responses",
                    description: "/v1/responses",
                  },
                ]}
                onChange={(chatApiMode) => updateChat({ chatApiMode })}
              />
            </Field>

            <FetchModelsButton
              kind="chat"
              loading={modelFetchKind === "chat" && isPending}
              onClick={() => refreshModels("chat")}
            />
            <TestConnectionButton
              kind="chat"
              loading={testKind === "chat" && isPending}
              onClick={() => testConnection("chat")}
            />
          </RuntimePanel>

          <RuntimePanel
            title="默认向量模型"
            desc="文章入库 embedding、兴趣画像 embedding、后续 RAG 检索会从这里读取"
            icon={Database}
            active={savedConfig.embedding.apiKeyConfigured}
          >
            <Field label="API Key">
              <KeyField
                configured={savedConfig.embedding.apiKeyConfigured}
                masked={savedConfig.embedding.apiKeyMasked}
                value={embedding.apiKey}
                onChange={(apiKey) => updateEmbedding({ apiKey })}
              />
            </Field>

            <Field label="OpenAI 兼容 Base URL" hint="可与对话模型不同">
              <Input
                value={embedding.baseUrl}
                onChange={(event) => updateEmbedding({ baseUrl: event.target.value })}
                placeholder="https://integrate.api.nvidia.com/v1"
              />
            </Field>

            <Field label="默认向量模型">
              <Input
                value={embedding.model}
                onChange={(event) => updateEmbedding({ model: event.target.value })}
                placeholder="nvidia/llama-nemotron-embed-1b-v2"
                className="font-mono"
              />
            </Field>

            <FetchModelsButton
              kind="embedding"
              loading={modelFetchKind === "embedding" && isPending}
              onClick={() => refreshModels("embedding")}
            />
            <TestConnectionButton
              kind="embedding"
              loading={testKind === "embedding" && isPending}
              onClick={() => testConnection("embedding")}
            />
          </RuntimePanel>

        </div>

        <aside className="rounded-lg border border-hairline bg-background">
          <div className="border-b border-hairline p-4">
            <div className="flex items-center gap-2">
              <BrainCircuit size={16} className="text-primary" />
              <h3 className="text-body-sm-medium text-ink">模型快捷选择</h3>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Search size={14} className="text-stone" />
              <Input
                placeholder="搜索模型"
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                className="h-8 border-0 bg-transparent px-2 text-body-sm focus-visible:ring-0"
              />
            </div>
            <div className="mt-3 flex gap-1">
              {[
                { key: "all", label: "全部" },
                { key: "chat", label: "对话" },
                { key: "embedding", label: "向量" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModelFilter(tab.key as typeof modelFilter)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-micro transition-colors",
                    modelFilter === tab.key
                      ? "bg-primary/10 text-primary"
                      : "text-steel hover:bg-surface hover:text-charcoal",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto p-3">
            {filteredModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                onSelect={() => selectModel(model)}
              />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function formatRebuildArticleProgress(rebuild: NonNullable<AISectionProps["latestRebuild"]>) {
  return rebuild.totalArticleCount > 0
    ? `${rebuild.articleCount}/${rebuild.totalArticleCount} 篇文章`
    : `${rebuild.articleCount} 篇文章`;
}

function RuntimePanel({
  title,
  desc,
  icon: Icon,
  active,
  tooltip,
  children,
}: {
  title: string;
  desc: string;
  icon: typeof MessageSquare;
  active: boolean;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-background">
      <div className="flex items-start justify-between gap-4 border-b border-hairline p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon size={17} aria-hidden />
          </span>
          <div>
            <h3 className="flex items-center gap-1.5 text-body font-medium text-ink">
              {title}
              {tooltip && (
                <span title={tooltip} className="cursor-help text-steel hover:text-charcoal">
                  <Info size={13} aria-hidden />
                </span>
              )}
            </h3>
            <p className="mt-1 text-body-sm text-steel">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-micro text-steel">
          <span>{active ? "Key 已配置" : "Key 未配置"}</span>
          <Switch checked={active} disabled className="h-5 w-9" />
        </div>
      </div>
      <div className="grid gap-5 p-5">{children}</div>
    </div>
  );
}

function TestConnectionButton({
  kind,
  loading,
  onClick,
}: {
  kind: "chat" | "embedding";
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-hairline bg-surface px-4 py-3">
      <div>
        <div className="text-body-sm-medium text-ink">连接测试</div>
        <div className="mt-1 text-micro text-steel">
          {kind === "chat" ? "验证对话接口是否可用" : "验证向量接口是否可用"}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className="shrink-0 gap-1.5"
      >
        {loading ? (
          <Loader2 size={14} aria-hidden className="animate-spin" />
        ) : (
          <Wifi size={14} aria-hidden />
        )}
        测试连接
      </Button>
    </div>
  );
}

function FetchModelsButton({
  kind,
  loading,
  onClick,
}: {
  kind: "chat" | "embedding";
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-hairline bg-surface px-4 py-3">
      <div>
        <div className="text-body-sm-medium text-ink">模型列表</div>
        <div className="mt-1 text-micro text-steel">
          {kind === "chat" ? "从对话接口拉取 /models" : "从向量接口拉取 /models"}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className="shrink-0 gap-1.5"
      >
        {loading ? (
          <Loader2 size={14} aria-hidden className="animate-spin" />
        ) : (
          <BrainCircuit size={14} aria-hidden />
        )}
        获取模型列表
      </Button>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; description: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 rounded-md border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary/50 bg-primary/8 text-ink"
                : "border-hairline bg-surface text-charcoal hover:border-primary/30",
            )}
          >
            <span className="block text-body-sm-medium">{option.label}</span>
            <span className="block truncate font-mono text-micro text-steel">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ModelRow({
  model,
  onSelect,
}: {
  model: ModelItem;
  onSelect: () => void;
}) {
  const primaryKind = model.supportsEmbedding && !model.supportsChat ? "embedding" : "chat";
  const Icon = primaryKind === "chat" ? MessageSquare : Database;
  const selected = model.selectedChat || model.selectedEmbedding;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/8 text-ink"
          : "border-hairline bg-surface text-charcoal hover:border-primary/30",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-primary">
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-body-sm">{model.name}</span>
        <span className="text-micro text-steel">
          {model.supportsChat && model.supportsEmbedding
            ? "对话 / 向量模型"
            : model.supportsChat
              ? "对话模型"
              : "向量模型"}
        </span>
      </span>
      {selected && <Check size={15} aria-hidden className="text-primary" />}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-body-sm-medium text-ink">{label}</span>
        {hint && <span className="text-micro text-steel">· {hint}</span>}
      </div>
      {children}
    </label>
  );
}

function KeyField({
  configured,
  masked,
  value,
  onChange,
}: {
  configured: boolean;
  masked: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const displayValue = value ? maskSecret(value) : configured ? masked : "未配置";

  return (
    <div className="relative">
      {visible || focused ? (
        <Input
          type={visible ? "text" : "password"}
          value={value}
          autoFocus={focused}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setFocused(false)}
          placeholder={configured ? "输入新 key 以替换" : "sk-..."}
          className="pr-10 font-mono"
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setFocused(true)}
          className={cn(
            "h-full w-full justify-start px-4 py-2 font-mono text-body-sm",
            configured || value ? "text-charcoal" : "text-stone",
          )}
        >
          {displayValue}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setVisible((current) => !current)}
        title={visible ? "隐藏" : "显示"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-steel hover:text-ink"
      >
        {visible ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
      </Button>
    </div>
  );
}

function capabilityForModel(
  model: string,
  kind: "chat" | "embedding",
): AIModelCapability {
  return {
    model,
    supportsChat: kind === "chat",
    supportsEmbedding: kind === "embedding",
  };
}

function mergeModelCapabilities(models: AIModelCapability[]) {
  const byModel = new Map<string, AIModelCapability>();

  for (const model of models) {
    const name = model.model.trim();
    if (!name) {
      continue;
    }

    const existing = byModel.get(name);
    byModel.set(name, {
      model: name,
      supportsChat: Boolean(existing?.supportsChat || model.supportsChat),
      supportsEmbedding: Boolean(
        existing?.supportsEmbedding || model.supportsEmbedding,
      ),
    });
  }

  return Array.from(byModel.values()).sort((a, b) =>
    a.model.localeCompare(b.model),
  );
}
