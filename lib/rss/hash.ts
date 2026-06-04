import { createHash } from "node:crypto";

export function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashArticleContent(input: {
  title?: string | null;
  url?: string | null;
  summaryRaw?: string | null;
  content?: string | null;
}) {
  return stableHash(
    JSON.stringify({
      title: input.title ?? "",
      url: input.url ?? "",
      summaryRaw: input.summaryRaw ?? "",
      content: input.content ?? "",
    }),
  );
}
