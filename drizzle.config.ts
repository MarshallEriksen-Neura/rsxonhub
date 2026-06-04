import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // pgvector 扩展需在首次迁移前手动启用:CREATE EXTENSION IF NOT EXISTS vector;
  // 见 lib/db/schema.ts 的 ENABLE_PGVECTOR
});
