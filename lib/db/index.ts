import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { schema } from "@/lib/db/schema";

/**
 * Drizzle + postgres.js 客户端。
 * 复用全局单例,避免 Next.js 热重载时连接数暴涨。
 */
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.client ?? postgres(env.DATABASE_URL, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });

export { schema };
