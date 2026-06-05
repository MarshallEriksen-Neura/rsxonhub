export type ConversationCursor = {
  updatedAt: string;
  id: number;
};

export function encodeConversationCursor(value: ConversationCursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseConversationCursor(value: string | null): ConversationCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const updatedAt = normalizeCursorDate(parsed?.updatedAt);

    if (!updatedAt || !Number.isInteger(parsed?.id)) {
      return null;
    }

    return { updatedAt, id: parsed.id };
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
