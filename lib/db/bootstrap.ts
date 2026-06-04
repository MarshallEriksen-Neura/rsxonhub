import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
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

/**
 * Idempotent server bootstrap for database-backed runtime state.
 */
export function bootstrapDatabase() {
  bootstrapPromise ??= syncEnvUser();
  return bootstrapPromise;
}

export async function ensureDatabaseBootstrapped() {
  await bootstrapDatabase();
}
