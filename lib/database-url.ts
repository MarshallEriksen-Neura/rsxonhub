const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export function normalizePostgresUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const schemeEnd = trimmed.indexOf("://");
  if (schemeEnd === -1) return trimmed;

  const authorityStart = schemeEnd + 3;
  const authorityEnd = findAuthorityEnd(trimmed, authorityStart);
  const authority = trimmed.slice(authorityStart, authorityEnd);
  const authEnd = authority.lastIndexOf("@");

  if (authEnd === -1) return trimmed;

  const rawAuth = authority.slice(0, authEnd);
  const host = authority.slice(authEnd + 1);
  const passwordStart = rawAuth.indexOf(":");
  const normalizedAuth =
    passwordStart === -1
      ? encodeCredential(rawAuth)
      : `${encodeCredential(rawAuth.slice(0, passwordStart))}:${encodeCredential(
          rawAuth.slice(passwordStart + 1),
        )}`;

  return `${trimmed.slice(0, authorityStart)}${normalizedAuth}@${host}${trimmed.slice(
    authorityEnd,
  )}`;
}

export function parsePostgresUrl(value: string) {
  const parsed = new URL(normalizePostgresUrl(value));
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("DATABASE_URL must use postgres or postgresql.");
  }
  return parsed;
}

function findAuthorityEnd(value: string, start: number) {
  const slash = value.indexOf("/", start);
  const question = value.indexOf("?", start);
  const hash = value.indexOf("#", start);
  const candidates = [slash, question, hash].filter((index) => index !== -1);
  return candidates.length > 0 ? Math.min(...candidates) : value.length;
}

function encodeCredential(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}
