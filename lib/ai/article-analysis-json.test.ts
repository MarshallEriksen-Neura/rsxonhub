import { describe, expect, test } from "bun:test";
import { parseArticleAnalysisText } from "@/lib/ai/article-analysis-parser";

describe("parseArticleAnalysisText", () => {
  test("accepts a plain JSON object", () => {
    expect(
      parseArticleAnalysisText(
        JSON.stringify({
          summary: "文章讨论 AI 风险治理。",
          bullets: ["风险策略需要更新", "支付和欺诈团队需要协作"],
          tags: ["AI", "风险"],
          importance: 80,
        }),
      ),
    ).toEqual({
      summary: "文章讨论 AI 风险治理。",
      bullets: ["风险策略需要更新", "支付和欺诈团队需要协作"],
      tags: ["AI", "风险"],
      importance: 80,
    });
  });

  test("extracts JSON from fenced or prefixed model output", () => {
    expect(
      parseArticleAnalysisText(`好的,结果如下:
\`\`\`json
{
  "summary": "Stripe 邀请风险和支付负责人讨论 AI 对欺诈策略的影响。",
  "bullets": ["会议在西雅图举办", "席位有限"],
  "tags": ["Stripe", "AI", "风控"],
  "importance": 65
}
\`\`\``),
    ).toEqual({
      summary: "Stripe 邀请风险和支付负责人讨论 AI 对欺诈策略的影响。",
      bullets: ["会议在西雅图举办", "席位有限"],
      tags: ["Stripe", "AI", "风控"],
      importance: 65,
    });
  });

  test("recovers model JSON with unescaped quotes inside the summary string", () => {
    expect(
      parseArticleAnalysisText(`{
  "summary": "Google AI Edge Gallery 新增了"计划通知"功能，并扩展了端侧 AI 能力。",
  "bullets": ["新增实验性 MCP 支持", "Gemma 4 可以协调外部数据源"],
  "tags": ["Google", "端侧 AI", "MCP"],
  "importance": 72
}`),
    ).toEqual({
      summary: 'Google AI Edge Gallery 新增了"计划通知"功能，并扩展了端侧 AI 能力。',
      bullets: ["新增实验性 MCP 支持", "Gemma 4 可以协调外部数据源"],
      tags: ["Google", "端侧 AI", "MCP"],
      importance: 72,
    });
  });

  test("rejects JSON that does not match the article analysis schema", () => {
    expect(() =>
      parseArticleAnalysisText(
        JSON.stringify({
          summary: "",
          bullets: [],
          tags: [],
          importance: 101,
        }),
      ),
    ).toThrow("AI summary JSON did not match schema");
  });
});
