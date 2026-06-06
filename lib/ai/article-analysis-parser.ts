import { z } from "zod";

export const articleAnalysisSchema = z.object({
  summary: z.string().min(1).max(800),
  bullets: z.array(z.string().min(1).max(240)).max(5),
  tags: z.array(z.string().min(1).max(40)).max(6),
  importance: z.number().int().min(0).max(100),
});

export type AnalyzeArticleResult = z.infer<typeof articleAnalysisSchema>;

export function parseArticleAnalysisText(text: string): AnalyzeArticleResult {
  const jsonText = extractJsonObjectText(stripJsonFence(text));
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch {
    payload = recoverArticleAnalysisObject(jsonText);
    if (!payload) {
      throw new Error(`AI summary returned invalid JSON content: ${previewText(text)}`);
    }
  }

  const parsed = articleAnalysisSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`AI summary JSON did not match schema: ${parsed.error.message}`);
  }

  return parsed.data;
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function extractJsonObjectText(text: string) {
  const firstBrace = text.indexOf("{");
  if (firstBrace < 0) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(firstBrace, index + 1);
      }
    }
  }

  return text.slice(firstBrace);
}

function recoverArticleAnalysisObject(text: string) {
  const fields = fieldRanges(text);
  const summary = stringField(text, fields, "summary");
  const bullets = stringArrayField(text, fields, "bullets");
  const tags = stringArrayField(text, fields, "tags");
  const importance = numberField(text, fields, "importance");

  if (!summary || !bullets || !tags || importance === null) {
    return null;
  }

  return {
    summary,
    bullets,
    tags,
    importance,
  };
}

function fieldRanges(text: string) {
  const matches = Array.from(text.matchAll(/"(summary|bullets|tags|importance)"\s*:/g));
  return matches.map((match, index) => ({
    key: match[1],
    valueStart: match.index + match[0].length,
    valueEnd: matches[index + 1]?.index ?? text.lastIndexOf("}"),
  }));
}

function fieldSegment(
  text: string,
  fields: ReturnType<typeof fieldRanges>,
  key: string,
) {
  const field = fields.find((entry) => entry.key === key);
  if (!field || field.valueEnd < field.valueStart) return null;

  return text.slice(field.valueStart, field.valueEnd).replace(/,\s*$/, "").trim();
}

function stringField(
  text: string,
  fields: ReturnType<typeof fieldRanges>,
  key: string,
) {
  const segment = fieldSegment(text, fields, key);
  if (!segment?.startsWith('"')) return null;

  const withoutOpeningQuote = segment.slice(1);
  return withoutOpeningQuote.endsWith('"')
    ? withoutOpeningQuote.slice(0, -1).trim()
    : withoutOpeningQuote.trim();
}

function stringArrayField(
  text: string,
  fields: ReturnType<typeof fieldRanges>,
  key: string,
) {
  const segment = fieldSegment(text, fields, key);
  if (!segment) return null;

  try {
    const payload = JSON.parse(segment) as unknown;
    return Array.isArray(payload) && payload.every((item) => typeof item === "string")
      ? payload
      : null;
  } catch {
    return null;
  }
}

function numberField(
  text: string,
  fields: ReturnType<typeof fieldRanges>,
  key: string,
) {
  const segment = fieldSegment(text, fields, key);
  if (!segment) return null;

  const value = Number(segment);
  return Number.isFinite(value) ? value : null;
}

function previewText(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 160)}...` : compact;
}
