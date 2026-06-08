import { describe, expect, test } from "bun:test";
import {
  chunkArticleText,
  extractArticleTextBlocks,
  planArticleEmbeddingChunks,
} from "@/lib/ai/embedding-text";

describe("article embedding text chunking", () => {
  test("returns no chunks for empty and whitespace-only text", () => {
    expect(chunkArticleText("")).toEqual([]);
    expect(chunkArticleText(" \n\t ")).toEqual([]);
  });

  test("returns one titled chunk for short text", () => {
    expect(chunkArticleText("short article", "Article Title")).toEqual([
      "Article Title\nshort article",
    ]);
  });

  test("long Chinese text prefers sentence boundaries", () => {
    const text = Array.from({ length: 160 }, (_, index) => `第${index}句内容用于测试边界。`).join("");
    const chunks = chunkArticleText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].endsWith("。")).toBe(true);
  });

  test("paragraph breaks outrank sentence boundaries", () => {
    const firstParagraph = `${"a".repeat(760)}.`;
    const secondParagraph = `${"b".repeat(900)}.`;
    const chunks = chunkArticleText(`${firstParagraph}\n\n${secondParagraph}`);

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(firstParagraph);
  });

  test("keeps overlap between adjacent paragraph chunks", () => {
    const text = Array.from({ length: 260 }, (_, index) => `sentence-${index}.`).join(" ");
    const chunks = chunkArticleText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]).toContain(chunks[0].slice(-80).trim());
  });

  test("extracts sanitized HTML into structured blocks with sections", () => {
    const blocks = extractArticleTextBlocks(
      "<h1>Top</h1><p>Intro text.</p><h2>Details</h2><ul><li>First</li><li>Second</li></ul><blockquote>Quoted</blockquote><pre>code()</pre>",
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "list",
      "list",
      "quote",
      "code",
    ]);
    expect(blocks[3].sectionPath).toEqual(["Top", "Details"]);
  });

  test("plans metadata-rich chunks without title-only bodies", () => {
    const chunks = planArticleEmbeddingChunks("<h1>Title</h1><p>Body text.</p>", "Article");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      title: "Article",
      body: "Title\n\nBody text.",
      content: "Article\nTitle\n\nBody text.",
      chunkIndex: 0,
      chunkType: "mixed",
      sectionPath: ["Title"],
      charCount: "Title\n\nBody text.".length,
    });
    expect(chunks[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
