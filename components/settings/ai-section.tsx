"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  BrainCircuit,
  Check,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessageSquare,
  Search,
} from "lucide-react";
import { fetchAIModels, saveAISettings } from "@/app/(app)/settings/actions";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Switch } from "@/components/retroui/Switch";
import { maskSecret } from "@/lib/ai/mask";
import type { PublicAIConfigSnapshot } from "@/lib/ai/config";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

type AISectionProps = {
  initialConfig: PublicAIConfigSnapshot;
};

type ChatDraft = {
  baseUrl: string;
  apiKey: string;
  model: string;
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
  category: "chat" | "embedding";
  selected: boolean;
};

const CHAT_MODEL_SUGGESTIONS = [
  "deepseek-ai/deepseek-v3.1",
  "openai/gpt-oss-120b",
  "meta/llama-3.3-70b-instruct",
];

const EMBEDDING_MODEL_SUGGESTIONS = [
  "nvidia/llama-nemotron-embed-1b-v2",
  "nvidia/nv-embedqa-e5-v5",
];

export function AISection({ initialConfig }: AISectionProps) {
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [chat, setChat] = useState<ChatDraft>(() => ({
    baseUrl: initialConfig.chat.baseUrl,
    apiKey: "",
    model: initialConfig.chat.model,
    temperature: initialConfig.chat.temperature,
  }));
  const [embedding, setEmbedding] = useState<EmbeddingDraft>(() => ({
    baseUrl: initialConfig.embedding.baseUrl,
    apiKey: "",
    model: initialConfig.embedding.model,
    dimension: initialConfig.embedding.dimension,
  }));
  const [chatModels, setChatModels] = useState<string[]>(CHAT_MODEL_SUGGESTIONS);
  const [embeddingModels, setEmbeddingModels] = useState<string[]>(
    EMBEDDING_MODEL_SUGGESTIONS,
  );
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [modelFetchKind, setModelFetchKind] = useState<"chat" | "embedding" | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<"all" | "chat" | "embedding">("all");

  const modelItems = useMemo<ModelItem[]>(() => {
    const uniqueChatModels = unique([chat.model, savedConfig.chat.model, ...chatModels]);
    const uniqueEmbeddingModels = unique([
      embedding.model,
      savedConfig.embedding.model,
      ...embeddingModels,
    ]);

    return [
      ...uniqueChatModels.map((name) => ({
        id: `chat:${name}`,
        name,
        category: "chat" as const,
        selected: name === chat.model,
      })),
      ...uniqueEmbeddingModels.map((name) => ({
        id: `embedding:${name}`,
        name,
        category: "embedding" as const,
        selected: name === embedding.model,
      })),
    ];
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
    const matchFilter = modelFilter === "all" || model.category === modelFilter;
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
    setNotice(null);
    setError(null);
  };

  const selectModel = (model: ModelItem) => {
    if (model.category === "chat") {
      updateChat({ model: model.name });
      return;
    }

    updateEmbedding({ model: model.name });
  };

  const refreshModels = (kind: "chat" | "embedding") => {
    setModelFetchKind(kind);
    setNotice(null);
    setError(null);

    startTransition(async () => {
      const config = kind === "chat" ? chat : embedding;
      const result = await fetchAIModels({
        kind,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });

      setModelFetchKind(null);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.kind === "chat") {
        setChatModels(result.models);
        setModelFilter("chat");
      } else {
        setEmbeddingModels(result.models);
        setModelFilter("embedding");
      }

      setNotice(result.message);
    });
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveAISettings({
        chat,
        embedding,
      });

      if (!result.ok) {
        setError(result.message);
        setNotice(null);
        return;
      }

      setSavedConfig(result.config);
      setChat((current) => ({
        ...current,
        apiKey: "",
        baseUrl: result.config.chat.baseUrl,
        model: result.config.chat.model,
        temperature: result.config.chat.temperature,
      }));
      setEmbedding((current) => ({
        ...current,
        apiKey: "",
        baseUrl: result.config.embedding.baseUrl,
        model: result.config.embedding.model,
        dimension: result.config.embedding.dimension,
      }));
      setDirty(false);
      setError(null);
      setNotice(result.message);
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
            onClick={save}
            className="gap-1.5"
          >
            {isPending ? (
              <Loader2 size={15} aria-hidden className="animate-spin" />
            ) : (
              <Check size={15} aria-hidden />
            )}
            {dirty ? "保存更改" : "已保存"}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-5">
          <RuntimePanel
            title="默认对话模型"
            desc="聊天、摘要、日报筛选等文本生成任务会从这里读取"
            icon={MessageSquare}
            active={savedConfig.chat.apiKeyConfigured}
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

            <FetchModelsButton
              kind="chat"
              loading={modelFetchKind === "chat" && isPending}
              onClick={() => refreshModels("chat")}
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
          </RuntimePanel>

          <div className="flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-micro text-steel">
            <Lock size={12} aria-hidden />
            <span>保存后配置进入后端 ai_configs 表；运行时只通过 lib/ai/index.ts 读取。</span>
          </div>
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

function RuntimePanel({
  title,
  desc,
  icon: Icon,
  active,
  children,
}: {
  title: string;
  desc: string;
  icon: typeof MessageSquare;
  active: boolean;
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
            <h3 className="text-body font-medium text-ink">{title}</h3>
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

function ModelRow({
  model,
  onSelect,
}: {
  model: ModelItem;
  onSelect: () => void;
}) {
  const Icon = model.category === "chat" ? MessageSquare : Database;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
        model.selected
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
          {model.category === "chat" ? "对话模型" : "向量模型"}
        </span>
      </span>
      {model.selected && <Check size={15} aria-hidden className="text-primary" />}
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

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
