import { z } from "zod";
import { normalizeHttpUrl } from "@/lib/url";

/**
 * 集中校验与导出环境变量。见 docs/product-design.md §8。
 * 在服务端模块顶层 import 即触发校验,缺失关键变量时尽早失败。
 */
const optionalString = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  );

const urlString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return normalizeHttpUrl(value);
    },
    z.string().url(),
  );

const schema = z.object({
  DATABASE_URL: urlString(),
  RSSHUB_BASE_URL: urlString().default("https://rsshub.app"),
  RSS_FETCH_PROXY: optionalString(),

  // 登录(Auth.js Credentials)
  AUTH_SECRET: optionalString(),
  AUTH_USERNAME: optionalString(),
  AUTH_PASSWORD: optionalString(),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
