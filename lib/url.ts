const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;

export function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return ABSOLUTE_URL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parseHttpUrl(value: string) {
  const normalized = normalizeHttpUrl(value);
  const parsed = new URL(normalized);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  return parsed;
}
