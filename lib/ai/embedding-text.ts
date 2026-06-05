import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";

const CHUNK_TARGET_CHARS = 1_200;
const CHUNK_OVERLAP_CHARS = 240;
const MIN_BOUNDARY_POS = CHUNK_TARGET_CHARS * 0.6;

export function chunkArticleText(text: string, titlePrefix?: string) {
  const normalized = text.replace(/[^\S\n]+/g, " ").trim();
  if (!normalized) return [];

  if (normalized.length <= 600) {
    return [titlePrefix ? `${titlePrefix}\n${normalized}` : normalized];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const hardEnd = Math.min(normalized.length, start + CHUNK_TARGET_CHARS);
    const boundary = findBoundary(normalized, start, hardEnd);
    const chunk = normalized.slice(start, boundary).trim();
    if (chunk) {
      chunks.push(titlePrefix ? `${titlePrefix}\n${chunk}` : chunk);
    }
    if (boundary >= normalized.length) break;
    start = Math.max(boundary - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return chunks;
}

export function expectedEmbeddingDimension() {
  return DEFAULT_EMBEDDING_DIM;
}

function findBoundary(text: string, start: number, hardEnd: number) {
  if (hardEnd >= text.length) return text.length;
  const slice = text.slice(start, hardEnd);

  const paragraphBreak = slice.lastIndexOf("\n\n");
  if (paragraphBreak > MIN_BOUNDARY_POS) return start + paragraphBreak + 2;

  const chineseSentenceEnd = slice.lastIndexOf("。\n");
  if (chineseSentenceEnd > MIN_BOUNDARY_POS) return start + chineseSentenceEnd + 2;

  const chinesePeriod = slice.lastIndexOf("。");
  if (chinesePeriod > MIN_BOUNDARY_POS) return start + chinesePeriod + 1;

  const periodNewline = slice.lastIndexOf(".\n");
  if (periodNewline > MIN_BOUNDARY_POS) return start + periodNewline + 2;

  const period = slice.lastIndexOf(". ");
  if (period > MIN_BOUNDARY_POS) return start + period + 2;

  const space = slice.lastIndexOf(" ");
  if (space > MIN_BOUNDARY_POS) return start + space + 1;

  return hardEnd;
}
