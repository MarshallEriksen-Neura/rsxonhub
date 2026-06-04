import { z } from "zod";

/**
 * 集中校验与导出环境变量。见 docs/product-design.md §8。
 * 在服务端模块顶层 import 即触发校验,缺失关键变量时尽早失败。
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),

  // 登录(Auth.js Credentials)
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_USERNAME: z.string().min(1).optional(),
  AUTH_PASSWORD_HASH: z.string().min(1).optional(),

  // Chat / 摘要 / Digest(OpenAI 兼容)
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().optional(),

  // Embedding(NVIDIA,OpenAI 兼容)
  EMBEDDING_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("nvidia/llama-nemotron-embed-1b-v2"),
  // pgvector 列维度由此决定,必须等于模型真实输出维度(见 §6 坑 1)
  EMBEDDING_DIM: z.coerce.number().int().positive().default(2048),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
