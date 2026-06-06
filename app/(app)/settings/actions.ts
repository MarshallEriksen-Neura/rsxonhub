"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { compare, hash } from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { aiRequestFetch, createAIRequestFetch } from "@/lib/ai";
import { probeChatCompletionsConnection } from "@/lib/ai/chat-completions-probe";
import {
  getAIConfig,
  getChatConfig,
  getEmbeddingConfig,
  parseAIConfigInput,
  upsertAIConfigs,
  type AIConfigKind,
  type PublicAIConfigSnapshot,
  type SaveAIConfigInput,
} from "@/lib/ai/config";
import {
  buildNextAIConfigPlan,
  embeddingConfigPlanChanged,
} from "@/lib/ai/config-plan";
import {
  attachEmbeddingRebuildRunJob,
  createEmbeddingRebuildRun,
  getEmbeddingVectorDimension,
  getLatestEmbeddingRebuildRun,
  markEmbeddingRebuildRunFailed,
  prepareEmbeddingDimensionRebuild,
  probeEmbeddingDimension,
} from "@/lib/ai/embedding-rebuild";
import { planEmbeddingRebuild } from "@/lib/ai/embedding-rebuild-plan";
import {
  inferModelCapabilities,
  type AIModelCapability,
  type AIModelPresetSnapshot,
} from "@/lib/ai/model-presets";
import { db } from "@/lib/db";
import {
  aiModelPresets,
  articleChunks,
  feedFetchRuns,
  feeds,
  usageLogs,
  users,
} from "@/lib/db/schema";
import { getActiveInterestProfile, saveInterestProfile } from "@/lib/interests/profile";
import {
  enqueueAnalysisForSelectedCandidates,
  enqueueArticleEmbedding,
} from "@/lib/jobs/feed-jobs";

export type SaveAISettingsState =
  | {
      ok: true;
      config: PublicAIConfigSnapshot;
      message: string;
    }
  | {
      ok: false;
      message: string;
    }
  | {
      ok: false;
      kind: "embedding-rebuild-required";
      message: string;
      existingChunkCount: number;
      probedDimension: number;
      expectedDimension: number;
    };

export async function saveAISettings(
  input: SaveAIConfigInput & { confirmEmbeddingRebuild?: boolean },
): Promise<SaveAISettingsState> {
  try {
    const parsed = parseAIConfigInput(input);
    const [existingChat, existingEmbedding] = await Promise.all([
      getChatConfig(),
      getEmbeddingConfig(),
    ]);
    const { chat, embedding } = buildNextAIConfigPlan(parsed, existingChat, existingEmbedding);
    const embeddingChanged = embeddingConfigPlanChanged(existingEmbedding, embedding);
    let embeddingToSave = embedding;
    let rebuildRunId: number | null = null;

    if (embeddingChanged) {
      const probedDimension = await probeEmbeddingDimension(embedding);
      embeddingToSave = { ...embedding, dimension: probedDimension };
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(articleChunks);
      const existingChunkCount = Number(count ?? 0);
      const expectedDimension = await getEmbeddingVectorDimension("article_chunks");
      const rebuildPlan = planEmbeddingRebuild({
        embeddingChanged,
        existingChunkCount,
        probedDimension,
        expectedDimension,
        confirmed: Boolean(input.confirmEmbeddingRebuild),
      });

      if (rebuildPlan.action === "confirm") {
        return {
          ok: false,
          kind: "embedding-rebuild-required",
          message: rebuildPlan.message,
          existingChunkCount: rebuildPlan.existingChunkCount,
          probedDimension: rebuildPlan.probedDimension,
          expectedDimension: rebuildPlan.expectedDimension,
        };
      }

      if (rebuildPlan.action === "rebuild" && rebuildPlan.resizeDimension) {
        await prepareEmbeddingDimensionRebuild(rebuildPlan.resizeDimension);
      }
    }

    const config = await upsertAIConfigs(chat, embeddingToSave);

    if (embeddingChanged) {
      rebuildRunId = await createAndEnqueueEmbeddingRebuildRun();
    }

    revalidatePath("/settings");

    return {
      ok: true,
      config,
      message: rebuildRunId
        ? `AI 配置已保存,向量重建任务 #${rebuildRunId} 已入队。`
        : "AI 配置已保存。",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存 AI 配置失败。",
    };
  }
}

const testAIConnectionSchema = z.object({
  kind: z.enum(["chat", "embedding"]),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  chatApiMode: z.enum(["chat_completions", "responses"]).optional(),
});

export type TestAIConnectionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function testAIConnection(
  input: z.input<typeof testAIConnectionSchema>,
): Promise<TestAIConnectionState> {
  try {
    const parsed = testAIConnectionSchema.parse(input);
    const saved =
      parsed.kind === "chat"
        ? await getAIConfig("chat")
        : await getAIConfig("embedding");
    const apiKey = parsed.apiKey?.trim() || saved.apiKey.trim();

    if (!apiKey) {
      return { ok: false, message: "API Key 未配置。" };
    }

    const provider = createOpenAI({
      baseURL: parsed.baseUrl,
      apiKey,
      fetch:
        parsed.kind === "embedding"
          ? createAIRequestFetch({ nvidiaEmbeddingInputType: "query" })
          : createAIRequestFetch({
              nvidiaChatTemplateKwargs: {
                thinking: true,
                reasoning_effort: "high",
              },
            }),
    });

    if (parsed.kind === "chat") {
      if (parsed.chatApiMode === "responses") {
        const { generateText } = await import("ai");
        await generateText({
          model: provider.responses(parsed.model),
          prompt: "Reply with exactly: pong",
          maxOutputTokens: 64,
        });
      } else {
        await probeChatCompletionsConnection({
          baseUrl: parsed.baseUrl,
          apiKey,
          model: parsed.model,
        });
      }
      return { ok: true, message: "对话模型连接成功。" };
    } else {
      const { embed } = await import("ai");
      await embed({
        model: provider.embedding(parsed.model),
        value: "test",
      });
      return { ok: true, message: "向量模型连接成功。" };
    }
  } catch (error) {
    return {
      ok: false,
      message: formatAIConnectionError(error),
    };
  }
}

const fetchAIModelsSchema = z.object({
  kind: z.enum(["chat", "embedding"]),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
});

export type FetchAIModelsState =
  | {
      ok: true;
      kind: AIConfigKind;
      models: AIModelCapability[];
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function getAIModelPresetSnapshot(
  config: PublicAIConfigSnapshot,
): Promise<AIModelPresetSnapshot> {
  const [chatRows, embeddingRows] = await Promise.all([
    getAIModelPresets("chat", config.chat.baseUrl),
    getAIModelPresets("embedding", config.embedding.baseUrl),
  ]);

  return {
    chat: chatRows,
    embedding: embeddingRows,
  };
}

export async function fetchAIModels(
  input: z.input<typeof fetchAIModelsSchema>,
): Promise<FetchAIModelsState> {
  try {
    const parsed = fetchAIModelsSchema.parse(input);
    const savedConfig =
      parsed.kind === "chat"
        ? await getAIConfig("chat")
        : await getAIConfig("embedding");
    const apiKey = parsed.apiKey?.trim() || savedConfig.apiKey.trim();

    if (!apiKey) {
      return {
        ok: false,
        message: "API Key 未配置,无法获取模型列表。",
      };
    }

    const response = await aiRequestFetch(modelsUrl(parsed.baseUrl), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `获取模型列表失败: ${response.status} ${response.statusText}`,
      };
    }

    const payload = await response.json();
    const models = parseModelCapabilities(payload, parsed.kind);

    if (models.length === 0) {
      return {
        ok: false,
        message: "接口返回成功,但没有找到可用模型。",
      };
    }

    await replaceAIModelPresets(parsed.kind, parsed.baseUrl, models);
    revalidatePath("/settings");

    return {
      ok: true,
      kind: parsed.kind,
      models,
      message: `已获取 ${models.length} 个模型,已自动区分对话/向量能力。`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "获取模型列表失败。",
    };
  }
}

async function getAIModelPresets(kind: AIConfigKind, baseUrl: string) {
  const rows = await db
    .select({
      model: aiModelPresets.model,
      supportsChat: aiModelPresets.supportsChat,
      supportsEmbedding: aiModelPresets.supportsEmbedding,
    })
    .from(aiModelPresets)
    .where(
      and(
        eq(aiModelPresets.kind, kind),
        eq(aiModelPresets.baseUrl, normalizeBaseUrl(baseUrl)),
      ),
    )
    .orderBy(aiModelPresets.model);

  return rows.map((row) => ({
    model: row.model,
    supportsChat: Boolean(row.supportsChat),
    supportsEmbedding: Boolean(row.supportsEmbedding),
  }));
}

async function replaceAIModelPresets(
  kind: AIConfigKind,
  baseUrl: string,
  models: AIModelCapability[],
) {
  const values = buildAIModelPresetRows(kind, baseUrl, models);

  await db.transaction(async (tx) => {
    await tx.delete(aiModelPresets).where(
      and(
        eq(aiModelPresets.kind, kind),
        eq(aiModelPresets.baseUrl, normalizeBaseUrl(baseUrl)),
      ),
    );

    await tx.insert(aiModelPresets).values(values);
  });
}

function buildAIModelPresetRows(
  kind: AIConfigKind,
  baseUrl: string,
  models: AIModelCapability[],
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return models.map((model) => ({
    kind,
    baseUrl: normalizedBaseUrl,
    model: model.model,
    supportsChat: model.supportsChat,
    supportsEmbedding: model.supportsEmbedding,
    lastFetchedAt: sql`now()`,
  }));
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "当前密码不能为空"),
    newPassword: z.string().min(8, "新密码至少需要8个字符"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  });

export type ChangePasswordState =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
      field?: "currentPassword" | "newPassword" | "confirmPassword";
    };

export async function changePassword(
  input: z.input<typeof changePasswordSchema>,
): Promise<ChangePasswordState> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        ok: false,
        message: "未登录",
      };
    }

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      const fieldError = parsed.error.issues[0];
      return {
        ok: false,
        message: fieldError.message,
        field: fieldError.path[0] as "currentPassword" | "newPassword" | "confirmPassword",
      };
    }

    const userId = Number(session.user.id);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return {
        ok: false,
        message: "用户不存在",
      };
    }

    const isPasswordValid = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return {
        ok: false,
        message: "当前密码错误",
        field: "currentPassword",
      };
    }

    const newPasswordHash = await hash(parsed.data.newPassword, 12);
    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));

    revalidatePath("/settings");

    return {
      ok: true,
      message: "密码修改成功",
    };
  } catch (error) {
    console.error("修改密码失败:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "修改密码失败",
    };
  }
}

const saveInterestProfileSchema = z.object({
  content: z.string().trim().min(1).max(6000),
});

export type SaveInterestProfileState =
  | {
      ok: true;
      content: string;
      version: number;
      enqueued: number;
      message: string;
    }
  | {
      ok: false;
      kind: "embedding-rebuild-required";
      message: string;
      probedDimension: number;
      expectedDimension: number;
    }
  | {
      ok: false;
      message: string;
    };

export async function getInterestProfileSnapshot() {
  return getActiveInterestProfile();
}

export async function saveInterestProfileSettings(
  input: z.input<typeof saveInterestProfileSchema>,
): Promise<SaveInterestProfileState> {
  try {
    const parsed = saveInterestProfileSchema.parse(input);
    const { profile, changed } = await saveInterestProfile(parsed.content);
    const enqueued = changed
      ? (await enqueueAnalysisForSelectedCandidates()).enqueuedAnalysisCount
      : 0;
    revalidatePath("/settings");

    return {
      ok: true,
      content: profile.content,
      version: profile.version,
      enqueued,
      message: changed
        ? `兴趣画像已保存为 v${profile.version},已入队 ${enqueued} 个候选分析任务。`
        : `兴趣画像未变化,仍为 v${profile.version}。`,
    };
  } catch (error) {
    const dimensionMismatch = parseEmbeddingDimensionMismatch(error);
    if (dimensionMismatch) {
      return {
        ok: false,
        kind: "embedding-rebuild-required",
        message: "当前向量索引维度与向量模型不一致。请先重建向量索引,完成后再保存画像。",
        ...dimensionMismatch,
      };
    }

    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存兴趣画像失败。",
    };
  }
}

export type RebuildEmbeddingIndexState =
  | { ok: true; rebuildRunId: number; message: string }
  | { ok: false; message: string };

export async function rebuildEmbeddingIndexForCurrentModel(): Promise<RebuildEmbeddingIndexState> {
  try {
    const probedDimension = await probeEmbeddingDimension();
    await prepareEmbeddingDimensionRebuild(probedDimension);
    const [chatConfig, embeddingConfig] = await Promise.all([
      getChatConfig(),
      getEmbeddingConfig(),
    ]);
    await upsertAIConfigs(chatConfig, { ...embeddingConfig, dimension: probedDimension });
    const rebuildRunId = await createAndEnqueueEmbeddingRebuildRun();
    revalidatePath("/settings");

    return {
      ok: true,
      rebuildRunId,
      message: `向量索引已切换为 ${probedDimension} 维,重建任务 #${rebuildRunId} 已入队。`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "重建向量索引失败。",
    };
  }
}

async function createAndEnqueueEmbeddingRebuildRun() {
  const run = await createEmbeddingRebuildRun();

  try {
    const jobId = await enqueueArticleEmbedding({ rebuildRunId: run.id });
    if (!jobId) {
      throw new Error("向量重建任务没有返回 jobId,可能被 pg-boss singleton 规则跳过。");
    }
    await attachEmbeddingRebuildRunJob(run.id, jobId);
    return run.id;
  } catch (error) {
    await markEmbeddingRebuildRunFailed(run.id, error);
    throw error;
  }
}

export async function getSettingsObservabilitySnapshot() {
  const [latestRebuild, recentFetchRuns, usageTotals] = await Promise.all([
    getLatestEmbeddingRebuildRun(),
    db
      .select({
        id: feedFetchRuns.id,
        feedId: feedFetchRuns.feedId,
        feedTitle: feeds.title,
        status: feedFetchRuns.status,
        itemCount: feedFetchRuns.itemCount,
        insertedCount: feedFetchRuns.insertedCount,
        updatedCount: feedFetchRuns.updatedCount,
        error: feedFetchRuns.error,
        startedAt: feedFetchRuns.startedAt,
        finishedAt: feedFetchRuns.finishedAt,
      })
      .from(feedFetchRuns)
      .innerJoin(feeds, eq(feeds.id, feedFetchRuns.feedId))
      .orderBy(desc(feedFetchRuns.startedAt))
      .limit(8),
    db
      .select({
        kind: usageLogs.kind,
        model: usageLogs.model,
        calls: sql<number>`count(*)`,
        tokens: sql<number>`coalesce(sum(${usageLogs.tokens}), 0)`,
        cost: sql<number>`coalesce(sum(${usageLogs.cost}), 0)`,
      })
      .from(usageLogs)
      .groupBy(usageLogs.kind, usageLogs.model)
      .orderBy(usageLogs.kind, usageLogs.model),
  ]);

  return {
    latestRebuild: latestRebuild
      ? {
          id: latestRebuild.id,
          status: latestRebuild.status,
          model: latestRebuild.model,
          baseUrl: latestRebuild.baseUrl,
          dimension: latestRebuild.dimension,
          articleCount: latestRebuild.articleCount,
          chunkCount: latestRebuild.chunkCount,
          jobId: latestRebuild.jobId,
          totalArticleCount: latestRebuild.totalArticleCount,
          lastProcessedArticleId: latestRebuild.lastProcessedArticleId,
          lastProcessedAt: latestRebuild.lastProcessedAt?.toISOString() ?? null,
          error: latestRebuild.error,
          startedAt: latestRebuild.startedAt?.toISOString() ?? null,
          finishedAt: latestRebuild.finishedAt?.toISOString() ?? null,
          createdAt: latestRebuild.createdAt.toISOString(),
        }
      : null,
    recentFetchRuns: recentFetchRuns.map((run) => ({
      id: run.id,
      feedId: run.feedId,
      feedTitle: run.feedTitle ?? `Feed #${run.feedId}`,
      status: run.status,
      itemCount: run.itemCount,
      insertedCount: run.insertedCount,
      updatedCount: run.updatedCount,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    usageTotals: usageTotals.map((row) => ({
      kind: row.kind,
      model: row.model,
      calls: Number(row.calls ?? 0),
      tokens: Number(row.tokens ?? 0),
      cost: Number(row.cost ?? 0),
    })),
  };
}

function modelsUrl(baseUrl: string) {
  return new URL("models", normalizeBaseUrl(baseUrl)).toString();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function parseModelCapabilities(payload: unknown, fallbackKind: AIConfigKind) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  ) {
    return [];
  }

  const byModel = new Map<string, AIModelCapability>();

  for (const item of payload.data) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "string"
    ) {
      continue;
    }

    const inferred = inferModelCapabilities(item.id, item, fallbackKind);
    const existing = byModel.get(item.id);
    byModel.set(item.id, {
      model: item.id,
      supportsChat: Boolean(existing?.supportsChat || inferred.supportsChat),
      supportsEmbedding: Boolean(
        existing?.supportsEmbedding || inferred.supportsEmbedding,
      ),
    });
  }

  return Array.from(byModel.values()).sort((a, b) =>
    a.model.localeCompare(b.model),
  );
}

function formatAIConnectionError(error: unknown) {
  const details = apiCallErrorDetails(error);
  if (details) {
    return details;
  }

  return error instanceof Error ? error.message : "连接失败。";
}

function apiCallErrorDetails(error: unknown) {
  if (!isRecord(error)) return null;

  const message =
    typeof error.message === "string" && error.message
      ? error.message
      : "AI provider request failed";
  const url = typeof error.url === "string" ? error.url : null;
  const statusCode =
    typeof error.statusCode === "number" ? String(error.statusCode) : null;
  const responseHeaders = isRecord(error.responseHeaders)
    ? error.responseHeaders
    : null;
  const contentType =
    typeof responseHeaders?.["content-type"] === "string"
      ? responseHeaders["content-type"]
      : null;
  const responseBody =
    typeof error.responseBody === "string" ? error.responseBody : null;

  if (!url && !statusCode && !contentType && !responseBody) {
    return null;
  }

  return [
    message,
    url ? `url=${url}` : null,
    statusCode ? `status=${statusCode}` : null,
    contentType ? `content-type=${contentType}` : null,
    responseBody ? `body-preview=${previewBody(responseBody)}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("; ");
}

function previewBody(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEmbeddingDimensionMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/向量模型维度为 (\d+),但当前数据库向量列需要 (\d+)/);
  if (!match) return null;

  return {
    probedDimension: Number(match[1]),
    expectedDimension: Number(match[2]),
  };
}
