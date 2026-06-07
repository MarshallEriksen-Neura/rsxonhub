import { z } from "zod";
import { normalizePostgresUrl, parsePostgresUrl } from "@/lib/database-url";
import { parseClockTime } from "@/lib/datetime";
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

const postgresUrlString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return normalizePostgresUrl(value);
    },
    z.string().min(1).refine(
      (value) => {
        try {
          parsePostgresUrl(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Expected a postgres or postgresql URL" },
    ),
  );

const clockString = () =>
  z.string().refine(
    (value) => {
      try {
        parseClockTime(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected HH:mm within 00:00-23:59" },
  );

const positiveIntegerString = () => z.coerce.number().int().positive();

const schema = z.object({
  DATABASE_URL: postgresUrlString(),
  RSSHUB_BASE_URL: urlString().default("https://rsshub.app"),
  RSS_FETCH_PROXY: optionalString(),

  // 登录(Auth.js Credentials)
  AUTH_SECRET: optionalString(),
  AUTH_USERNAME: optionalString(),
  AUTH_PASSWORD: optionalString(),

  DIGEST_TIMEZONE: z.string().min(1).default("Asia/Shanghai"),
  DIGEST_GENERATE_AT: clockString().default("08:00"),
  DIGEST_PREPARE_AT: clockString().default("07:30"),
  DIGEST_TRIGGER_WINDOW_MINUTES: positiveIntegerString().default(10),
  DIGEST_SCAN_INTERVAL_MS: positiveIntegerString().default(300000),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
