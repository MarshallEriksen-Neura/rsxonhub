import { and, eq } from "drizzle-orm";
import { getChatConfig } from "@/lib/ai/config";
import {
  buildChatModelSelectionSnapshot,
  type ChatModelSelectionSnapshot,
} from "@/lib/ai/model-presets";
import { db } from "@/lib/db";
import { aiModelPresets } from "@/lib/db/schema";

export async function getChatModelSelectionSnapshot(): Promise<ChatModelSelectionSnapshot> {
  const config = await getChatConfig();
  const presets = await db
    .select({
      model: aiModelPresets.model,
      supportsChat: aiModelPresets.supportsChat,
      supportsEmbedding: aiModelPresets.supportsEmbedding,
    })
    .from(aiModelPresets)
    .where(
      and(
        eq(aiModelPresets.kind, "chat"),
        eq(aiModelPresets.baseUrl, normalizeBaseUrl(config.baseUrl)),
      ),
    )
    .orderBy(aiModelPresets.model);

  return buildChatModelSelectionSnapshot(config.model, presets);
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
