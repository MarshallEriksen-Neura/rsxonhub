import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConfigs } from "@/lib/db/schema";
import {
  DEFAULT_CHAT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_TEMPERATURE,
  DEFAULT_EMBEDDING_BASE_URL,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_EMBEDDING_MODEL,
} from "@/lib/ai/defaults";
import { maskSecret } from "@/lib/ai/mask";

export type AIConfigKind = "chat" | "embedding";

export type ChatRuntimeConfig = {
  kind: "chat";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
};

export type EmbeddingRuntimeConfig = {
  kind: "embedding";
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
};

export type AIRuntimeConfig = ChatRuntimeConfig | EmbeddingRuntimeConfig;

export type PublicChatConfig = Omit<ChatRuntimeConfig, "apiKey"> & {
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
};

export type PublicEmbeddingConfig = Omit<EmbeddingRuntimeConfig, "apiKey"> & {
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
};

export type PublicAIConfigSnapshot = {
  chat: PublicChatConfig;
  embedding: PublicEmbeddingConfig;
};

const saveAIConfigSchema = z.object({
  chat: z.object({
    baseUrl: z.preprocess((value) => trimString(value), z.string().url()),
    apiKey: z.string().optional(),
    model: z.preprocess((value) => trimString(value), z.string().min(1)),
    temperature: z.coerce.number().min(0).max(2),
  }),
  embedding: z.object({
    baseUrl: z.preprocess((value) => trimString(value), z.string().url()),
    apiKey: z.string().optional(),
    model: z.preprocess((value) => trimString(value), z.string().min(1)),
    dimension: z.coerce.number().int().positive().optional(),
  }),
});

export type SaveAIConfigInput = z.input<typeof saveAIConfigSchema>;

type AIConfigRow = typeof aiConfigs.$inferSelect;

export async function getChatConfig(): Promise<ChatRuntimeConfig> {
  return getAIConfig("chat");
}

export async function getEmbeddingConfig(): Promise<EmbeddingRuntimeConfig> {
  return getAIConfig("embedding");
}

export async function getAIConfig(kind: "chat"): Promise<ChatRuntimeConfig>;
export async function getAIConfig(kind: "embedding"): Promise<EmbeddingRuntimeConfig>;
export async function getAIConfig(kind: AIConfigKind): Promise<AIRuntimeConfig> {
  const [row] = await db
    .select()
    .from(aiConfigs)
    .where(eq(aiConfigs.kind, kind))
    .limit(1);

  // 按 kind 分发到对应重载,使返回类型可被精确收窄(union 无法匹配字面量重载)。
  return kind === "chat"
    ? rowToRuntimeConfig("chat", row)
    : rowToRuntimeConfig("embedding", row);
}

export async function getPublicAIConfigSnapshot(): Promise<PublicAIConfigSnapshot> {
  const [chat, embedding] = await Promise.all([
    getChatConfig(),
    getEmbeddingConfig(),
  ]);

  return {
    chat: toPublicConfig(chat),
    embedding: toPublicConfig(embedding),
  };
}

export async function saveAIConfigSnapshot(
  input: SaveAIConfigInput,
): Promise<PublicAIConfigSnapshot> {
  const parsed = saveAIConfigSchema.parse(input);
  const [existingChat, existingEmbedding] = await Promise.all([
    getChatConfig(),
    getEmbeddingConfig(),
  ]);

  const chat: ChatRuntimeConfig = {
    kind: "chat",
    baseUrl: parsed.chat.baseUrl,
    apiKey: nextApiKey(parsed.chat.apiKey, existingChat.apiKey),
    model: parsed.chat.model,
    temperature: parsed.chat.temperature,
  };

  const embedding: EmbeddingRuntimeConfig = {
    kind: "embedding",
    baseUrl: parsed.embedding.baseUrl,
    apiKey: nextApiKey(parsed.embedding.apiKey, existingEmbedding.apiKey),
    model: parsed.embedding.model,
    dimension: DEFAULT_EMBEDDING_DIM,
  };

  await Promise.all([upsertConfig(chat), upsertConfig(embedding)]);

  return {
    chat: toPublicConfig(chat),
    embedding: toPublicConfig(embedding),
  };
}

function defaultRuntimeConfig(kind: "chat"): ChatRuntimeConfig;
function defaultRuntimeConfig(kind: "embedding"): EmbeddingRuntimeConfig;
function defaultRuntimeConfig(kind: AIConfigKind): AIRuntimeConfig {
  if (kind === "chat") {
    return {
      kind,
      baseUrl: DEFAULT_CHAT_BASE_URL,
      apiKey: "",
      model: DEFAULT_CHAT_MODEL,
      temperature: DEFAULT_CHAT_TEMPERATURE,
    };
  }

  return {
    kind,
    baseUrl: DEFAULT_EMBEDDING_BASE_URL,
    apiKey: "",
    model: DEFAULT_EMBEDDING_MODEL,
    dimension: DEFAULT_EMBEDDING_DIM,
  };
}

function rowToRuntimeConfig(kind: "chat", row?: AIConfigRow): ChatRuntimeConfig;
function rowToRuntimeConfig(kind: "embedding", row?: AIConfigRow): EmbeddingRuntimeConfig;
function rowToRuntimeConfig(kind: AIConfigKind, row?: AIConfigRow): AIRuntimeConfig {
  if (kind === "chat") {
    const defaults = defaultRuntimeConfig("chat");
    if (!row) return defaults;
    return {
      kind: "chat",
      baseUrl: row.baseUrl || defaults.baseUrl,
      apiKey: row.apiKey ?? "",
      model: row.model || defaults.model,
      temperature: row.temperature ?? DEFAULT_CHAT_TEMPERATURE,
    };
  }

  const defaults = defaultRuntimeConfig("embedding");
  if (!row) return defaults;
  return {
    kind: "embedding",
    baseUrl: row.baseUrl || defaults.baseUrl,
    apiKey: row.apiKey ?? "",
    model: row.model || defaults.model,
    dimension: row.dimension ?? DEFAULT_EMBEDDING_DIM,
  };
}

async function upsertConfig(config: AIRuntimeConfig) {
  await db
    .insert(aiConfigs)
    .values({
      kind: config.kind,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey.trim() || null,
      model: config.model,
      temperature: config.kind === "chat" ? config.temperature : null,
      dimension: config.kind === "embedding" ? config.dimension : null,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: aiConfigs.kind,
      set: {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey.trim() || null,
        model: config.model,
        temperature: config.kind === "chat" ? config.temperature : null,
        dimension: config.kind === "embedding" ? config.dimension : null,
        updatedAt: sql`now()`,
      },
    });
}

function toPublicConfig(config: ChatRuntimeConfig): PublicChatConfig;
function toPublicConfig(config: EmbeddingRuntimeConfig): PublicEmbeddingConfig;
function toPublicConfig(config: AIRuntimeConfig) {
  const { apiKey, ...safeConfig } = config;
  const trimmedApiKey = apiKey.trim();

  return {
    ...safeConfig,
    apiKeyConfigured: trimmedApiKey.length > 0,
    apiKeyMasked: maskSecret(trimmedApiKey),
  };
}

function nextApiKey(next: string | undefined, previous: string) {
  const trimmed = next?.trim();

  if (!trimmed) {
    return previous;
  }

  return trimmed;
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}
