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

const schema = z.object({
  DATABASE_URL: z.string().url(),

  // 登录(Auth.js Credentials)
  AUTH_SECRET: optionalString(),
  AUTH_USERNAME: optionalString(),
  AUTH_PASSWORD: optionalString(),
  AUTH_PASSWORD_HASH: optionalString(),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
