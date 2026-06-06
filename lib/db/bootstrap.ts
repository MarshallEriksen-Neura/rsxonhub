import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, aiConfigs } from "@/lib/db/schema";
import {
  DEFAULT_CHAT_API_MODE,
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
      "AUTH_USERNAME is set, but AUTH_PASSWORD is missing; skipping user bootstrap.",
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

  // 检查迁移历史是否存在，如果表存在但没有迁移记录，自动插入
  try {
    const [migrationResult] = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*) as "count" FROM drizzle.__drizzle_migrations`,
    );
    const migrationCount = Number(migrationResult?.count ?? 0);

    if (migrationCount === 0) {
      console.log("⚠️  Business tables exist but no migration history found. Inserting migration records...");
      
      // 插入迁移记录（标记所有迁移为已完成）
      const migrations = [
        { hash: "0000_mighty_black_panther", createdAt: 1780561893632 },
        { hash: "0001_youthful_pyro", createdAt: 1780566917684 },
        { hash: "0002_lying_naoko", createdAt: 1780571426691 },
        { hash: "0003_repair_feed_fetch_runs", createdAt: 1780576504234 },
        { hash: "0004_careful_swarm", createdAt: 1780581923526 },
      ];

      for (const migration of migrations) {
        await db.execute(
          sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
              VALUES (${migration.hash}, ${migration.createdAt})
              ON CONFLICT DO NOTHING`,
        );
      }
      
      console.log("✅ Migration records inserted successfully.");
    }
  } catch (error) {
    // 如果 __drizzle_migrations 表不存在，忽略错误
    console.log("Migration table does not exist yet. Will be created by drizzle-kit migrate.");
  }

  // 初始化 chat 配置
  await db
    .insert(aiConfigs)
    .values({
      kind: "chat",
      baseUrl: DEFAULT_CHAT_BASE_URL,
      model: DEFAULT_CHAT_MODEL,
      chatApiMode: DEFAULT_CHAT_API_MODE,
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
