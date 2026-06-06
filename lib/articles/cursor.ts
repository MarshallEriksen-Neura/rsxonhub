export type ArticleCursor = {
  sortAt: string;
  id: number;
  importance?: number;
};

export function encodeArticleCursor(value: ArticleCursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseArticleCursor(value: string | null): ArticleCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const sortAt = normalizeCursorDate(parsed?.sortAt);
    const importance = normalizeCursorImportance(parsed?.importance);

    if (!sortAt || !Number.isInteger(parsed?.id)) {
      return null;
    }

    return importance == null
      ? { sortAt, id: parsed.id }
      : { sortAt, id: parsed.id, importance };
  } catch {
    return null;
  }
}

function normalizeCursorDate(value: unknown) {
  if (typeof value !== "string") return null;

  const date = new Date(value);
  const time = date.getTime();

  return Number.isFinite(time) ? date.toISOString() : null;
}

function normalizeCursorImportance(value: unknown) {
  if (value == null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
