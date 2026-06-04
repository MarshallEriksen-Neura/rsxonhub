"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getAIConfig,
  saveAIConfigSnapshot,
  type AIConfigKind,
  type PublicAIConfigSnapshot,
  type SaveAIConfigInput,
} from "@/lib/ai/config";

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
