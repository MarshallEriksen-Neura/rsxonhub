import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";
import { createHash } from "crypto";

const SHORT_TEXT_CHARS = 600;
const CHUNK_TARGET_CHARS = 1_200;
const CHUNK_HARD_MAX_CHARS = 1_800;
const CHUNK_OVERLAP_CHARS = 180;
const MIN_TAIL_CHARS = 240;
const MIN_BOUNDARY_POS = CHUNK_TARGET_CHARS * 0.6;

export function chunkArticleText(text: string, titlePrefix?: string) {
  return planArticleEmbeddingChunks(text, titlePrefix).map((chunk) => chunk.content);
}

export type ArticleTextBlock = {
  type: "heading" | "paragraph" | "list" | "quote" | "code" | "other";
  text: string;
  sectionPath: string[];
  charStart: number | null;
  charEnd: number | null;
};

export type ArticleEmbeddingChunk = {
  content: string;
  body: string;
  title: string | null;
  chunkIndex: number;
  chunkType: ArticleTextBlock["type"] | "mixed";
  sectionPath: string[];
  charStart: number | null;
  charEnd: number | null;
  charCount: number;
  contentHash: string;
};

export function planArticleEmbeddingChunks(
  sourceText: string,
  titlePrefix?: string,
): ArticleEmbeddingChunk[] {
  const blocks = extractArticleTextBlocks(sourceText);
  if (blocks.length === 0) return [];

  const normalizedBody = blocks.map((block) => block.text).join("\n\n").trim();
  if (!normalizedBody) return [];

  if (normalizedBody.length <= SHORT_TEXT_CHARS) {
    return [
      createChunk({
        body: normalizedBody,
        title: titlePrefix ?? null,
        chunkIndex: 0,
        sourceBlocks: blocks,
      }),
    ];
  }

  const planned: Array<{ body: string; sourceBlocks: ArticleTextBlock[] }> = [];
  let currentBlocks: ArticleTextBlock[] = [];
  let currentBody = "";

  for (const block of blocks) {
    if (block.text.length > CHUNK_HARD_MAX_CHARS) {
      flushCurrent();
      for (const part of splitOversizedBlock(block)) {
        planned.push({ body: part.text, sourceBlocks: [part] });
      }
      continue;
    }

    const nextBody = joinChunkBody(currentBody, block.text);
    if (currentBody && nextBody.length > CHUNK_TARGET_CHARS) {
      flushCurrent();
    }

    currentBlocks.push(block);
    currentBody = joinChunkBody(currentBody, block.text);
  }
  flushCurrent();

  mergeTinyTail(planned);

  return planned.map((chunk, index) =>
    createChunk({
      body: chunk.body,
      title: titlePrefix ?? null,
      chunkIndex: index,
      sourceBlocks: chunk.sourceBlocks,
    }),
  );

  function flushCurrent() {
    const body = currentBody.trim();
    if (!body) return;

    planned.push({
      body: addOverlap(planned.at(-1)?.body, body, currentBlocks),
      sourceBlocks: currentBlocks,
    });
    currentBlocks = [];
    currentBody = "";
  }
}

export function expectedEmbeddingDimension() {
  return DEFAULT_EMBEDDING_DIM;
}

export function extractArticleTextBlocks(sourceText: string): ArticleTextBlock[] {
  const source = sourceText.trim();
  if (!source) return [];

  if (!/<[a-z][\s\S]*>/i.test(source)) {
    return plainTextBlocks(source);
  }

  const blocks: ArticleTextBlock[] = [];
  const sectionPath: string[] = [];
  let cursor = 0;
  const blockPattern =
    /<(h[1-6]|p|li|blockquote|pre|code|div|section|article)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source))) {
    const tag = match[1].toLowerCase();
    const text = normalizeBlockText(stripHtml(match[2]));
    if (!text) continue;

    const type = blockTypeFromTag(tag);
    if (type === "heading") {
      const level = Number(tag.slice(1));
      const keep = Math.max(0, Math.min(sectionPath.length, level - 1));
      sectionPath.splice(keep, sectionPath.length - keep, text);
    }

    blocks.push({
      type,
      text,
      sectionPath: [...sectionPath],
      charStart: cursor,
      charEnd: cursor + text.length,
    });
    cursor += text.length + 2;
  }

  if (blocks.length > 0) return blocks;
  return plainTextBlocks(stripHtml(source));
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

function splitOversizedBlock(block: ArticleTextBlock): ArticleTextBlock[] {
  const chunks: ArticleTextBlock[] = [];
  let start = 0;
  while (start < block.text.length) {
    const hardEnd = Math.min(block.text.length, start + CHUNK_HARD_MAX_CHARS);
    const boundary = findBoundary(block.text, start, hardEnd);
    const text = block.text.slice(start, boundary).trim();
    if (text) {
      chunks.push({
        ...block,
        text,
        charStart: block.charStart === null ? null : block.charStart + start,
        charEnd: block.charStart === null ? null : block.charStart + boundary,
      });
    }
    if (boundary >= block.text.length) break;
    start = Math.max(boundary - overlapForBlock(block), start + 1);
  }
  return chunks;
}

function createChunk({
  body,
  title,
  chunkIndex,
  sourceBlocks,
}: {
  body: string;
  title: string | null;
  chunkIndex: number;
  sourceBlocks: ArticleTextBlock[];
}): ArticleEmbeddingChunk {
  const content = title ? `${title}\n${body}` : body;
  const types = new Set(sourceBlocks.map((block) => block.type));
  const sectionPath = sourceBlocks.find((block) => block.sectionPath.length > 0)?.sectionPath ?? [];
  const starts = sourceBlocks
    .map((block) => block.charStart)
    .filter((value): value is number => value !== null);
  const ends = sourceBlocks
    .map((block) => block.charEnd)
    .filter((value): value is number => value !== null);

  return {
    content,
    body,
    title,
    chunkIndex,
    chunkType: types.size === 1 ? [...types][0] : "mixed",
    sectionPath,
    charStart: starts.length > 0 ? Math.min(...starts) : null,
    charEnd: ends.length > 0 ? Math.max(...ends) : null,
    charCount: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
}

function plainTextBlocks(text: string): ArticleTextBlock[] {
  const normalized = text.replace(/[^\S\n]+/g, " ").trim();
  if (!normalized) return [];

  const parts = normalized.split(/\n{2,}/).map((part) => normalizeBlockText(part));
  const blocks: ArticleTextBlock[] = [];
  let cursor = 0;

  for (const part of parts) {
    if (!part) continue;
    blocks.push({
      type: "paragraph",
      text: part,
      sectionPath: [],
      charStart: cursor,
      charEnd: cursor + part.length,
    });
    cursor += part.length + 2;
  }

  return blocks;
}

function blockTypeFromTag(tag: string): ArticleTextBlock["type"] {
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "li") return "list";
  if (tag === "blockquote") return "quote";
  if (tag === "pre" || tag === "code") return "code";
  if (tag === "p") return "paragraph";
  return "other";
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h[1-6]|blockquote|pre|code|div|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function normalizeBlockText(text: string) {
  return text.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function joinChunkBody(current: string, next: string) {
  return current ? `${current}\n\n${next}` : next;
}

function addOverlap(
  previousBody: string | undefined,
  body: string,
  blocks: ArticleTextBlock[],
) {
  if (!previousBody || blocks.length === 0) return body;
  if (blocks.every((block) => block.type === "heading" || block.type === "list" || block.type === "code")) {
    return body;
  }
  const overlap = previousBody.slice(-CHUNK_OVERLAP_CHARS).trim();
  return overlap ? `${overlap}\n\n${body}` : body;
}

function overlapForBlock(block: ArticleTextBlock) {
  return block.type === "code" ? 0 : CHUNK_OVERLAP_CHARS;
}

function mergeTinyTail(chunks: Array<{ body: string; sourceBlocks: ArticleTextBlock[] }>) {
  if (chunks.length < 2) return;
  const tail = chunks.at(-1);
  const previous = chunks.at(-2);
  if (!tail || !previous || tail.body.length >= MIN_TAIL_CHARS) return;
  if (previous.body.length + tail.body.length > CHUNK_HARD_MAX_CHARS) return;

  previous.body = joinChunkBody(previous.body, tail.body);
  previous.sourceBlocks = [...previous.sourceBlocks, ...tail.sourceBlocks];
  chunks.pop();
}
