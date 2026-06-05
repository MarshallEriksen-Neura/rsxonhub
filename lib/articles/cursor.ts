export type ArticleCursor = {
  sortAt: string;
  id: number;
};

export function encodeArticleCursor(value: ArticleCursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseArticleCursor(value: string | null): ArticleCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const sortAt = normalizeCursorDate(parsed?.sortAt);

    if (!sortAt || !Number.isInteger(parsed?.id)) {
      return null;
    }

    return { sortAt, id: parsed.id };
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
