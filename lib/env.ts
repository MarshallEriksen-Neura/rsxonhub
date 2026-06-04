import { z } from "zod";

/**
 * 集中校验与导出环境变量。见 docs/product-design.md §8。
 * 在服务端模块顶层 import 即触发校验,缺失关键变量时尽早失败。
 */
const optionalString = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  );

const optionalUrl = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  );

const schema = z.object({
  DATABASE_URL: z.string().url(),

  // 登录(Auth.js Credentials)
  AUTH_SECRET: optionalString(),
  AUTH_USERNAME: optionalString(),
  AUTH_PASSWORD: optionalString(),
  AUTH_PASSWORD_HASH: optionalString(),

  // Chat / 摘要 / Digest(OpenAI 兼容)
  OPENAI_BASE_URL: optionalUrl(),
  OPENAI_API_KEY: optionalString(),
  CHAT_MODEL: optionalString(),

  // Embedding(NVIDIA,OpenAI 兼容)
  EMBEDDING_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().default("https://integrate.api.nvidia.com/v1"),
  ),
  EMBEDDING_API_KEY: optionalString(),
  EMBEDDING_MODEL: z.string().default("nvidia/llama-nemotron-embed-1b-v2"),
  // pgvector 列维度由此决定,必须等于模型真实输出维度(见 §6 坑 1)
  EMBEDDING_DIM: z.coerce.number().int().positive().default(2048),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
