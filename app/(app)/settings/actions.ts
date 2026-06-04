"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hash } from "bcryptjs";
import {
  getAIConfig,
  saveAIConfigSnapshot,
  type AIConfigKind,
  type PublicAIConfigSnapshot,
  type SaveAIConfigInput,
} from "@/lib/ai/config";
import { getActiveInterestProfile, saveInterestProfile } from "@/lib/interests/profile";
import { enqueueAnalysisForCurrentCandidates } from "@/lib/jobs/feed-jobs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";

export type SaveAISettingsState =
  | {
      ok: true;
      config: PublicAIConfigSnapshot;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function saveAISettings(
  input: SaveAIConfigInput,
): Promise<SaveAISettingsState> {
  try {
    const config = await saveAIConfigSnapshot(input);
    revalidatePath("/settings");

    return {
      ok: true,
      config,
      message: "AI 配置已保存。",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存 AI 配置失败。",
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
      models: string[];
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

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

    const response = await fetch(modelsUrl(parsed.baseUrl), {
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
    const models = parseModelIds(payload);

    if (models.length === 0) {
      return {
        ok: false,
        message: "接口返回成功,但没有找到可用模型。",
      };
    }

    return {
      ok: true,
      kind: parsed.kind,
      models,
      message: `已获取 ${models.length} 个模型。`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "获取模型列表失败。",
    };
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: z.string().min(8, "新密码至少需要8个字符"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
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

    // 验证当前密码
    const isPasswordValid = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return {
        ok: false,
        message: "当前密码错误",
        field: "currentPassword",
      };
    }

    // 哈希新密码
    const newPasswordHash = await hash(parsed.data.newPassword, 12);

    // 更新密码
    await db.update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, userId));

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
    const enqueued = changed ? await enqueueAnalysisForCurrentCandidates() : 0;
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
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存兴趣画像失败。",
    };
  }
}

function modelsUrl(baseUrl: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("models", normalizedBase).toString();
}

function parseModelIds(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  ) {
    return [];
  }

  return Array.from(
    new Set(
      payload.data
        .map((item) =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          typeof item.id === "string"
            ? item.id
            : undefined,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}
