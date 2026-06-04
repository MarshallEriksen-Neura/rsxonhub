import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, aiConfigs } from "@/lib/db/schema";
import {
  DEFAULT_CHAT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_TEMPERATURE,
  DEFAULT_EMBEDDING_BASE_URL,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_EMBEDDING_MODEL,
} from "@/lib/ai/defaults";
import { env } from "@/lib/env";

let bootstrapPromise: Promise<void> | undefined;

export function isMissingRelationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  );
}

async function usersTableExists() {
  const [result] = await db.execute<{ exists: boolean }>(
    sql`select to_regclass('public.users') is not null as "exists"`,
  );

  return result?.exists === true;
}

async function getEnvPasswordHash() {
  if (env.AUTH_PASSWORD_HASH) {
    return env.AUTH_PASSWORD_HASH;
  }

  if (env.AUTH_PASSWORD) {
    return hash(env.AUTH_PASSWORD, 12);
  }

  return undefined;
}

async function syncEnvUser() {
  if (!env.AUTH_USERNAME) {
    return;
  }

  const passwordHash = await getEnvPasswordHash();

  if (!passwordHash) {
    console.warn(
      "AUTH_USERNAME is set, but AUTH_PASSWORD or AUTH_PASSWORD_HASH is missing; skipping user bootstrap.",
    );
    return;
  }

  if (!(await usersTableExists())) {
    console.warn(
      'Skipping user bootstrap because table "users" does not exist. Run `bun run db:push` or `bun run db:migrate`, then restart the app.',
    );
    return;
  }

  await db
    .insert(users)
    .values({
      username: env.AUTH_USERNAME,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash,
      },
    });
}

async function initAIConfigs() {
  // 检查 ai_configs 表是否存在
  const [result] = await db.execute<{ exists: boolean }>(
    sql`select to_regclass('public.ai_configs') is not null as "exists"`,
  );

  if (result?.exists !== true) {
    console.warn(
      'Skipping AI config initialization because table "ai_configs" does not exist. Run `bun run db:push` or `bun run db:migrate`, then restart the app.',
    );
    return;
  }

  // 初始化 chat 配置
  await db
    .insert(aiConfigs)
    .values({
      kind: "chat",
      baseUrl: DEFAULT_CHAT_BASE_URL,
      model: DEFAULT_CHAT_MODEL,
      temperature: DEFAULT_CHAT_TEMPERATURE,
    })
    .onConflictDoNothing({
      target: aiConfigs.kind,
    });

  // 初始化 embedding 配置
  await db
    .insert(aiConfigs)
    .values({
      kind: "embedding",
      baseUrl: DEFAULT_EMBEDDING_BASE_URL,
      model: DEFAULT_EMBEDDING_MODEL,
      dimension: DEFAULT_EMBEDDING_DIM,
    })
    .onConflictDoNothing({
      target: aiConfigs.kind,
    });
}

/**
 * Idempotent server bootstrap for database-backed runtime state.
 */
export function bootstrapDatabase() {
  bootstrapPromise ??= Promise.all([syncEnvUser(), initAIConfigs()]).then(() => {});
  return bootstrapPromise;
}

export async function ensureDatabaseBootstrapped() {
  await bootstrapDatabase();
}
