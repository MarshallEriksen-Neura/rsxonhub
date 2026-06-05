/**
 * 所有 AI prompt 模板集中管理。
 * 业务代码通过具名导出取 prompt，不硬编码字符串。
 * 需要替换 prompt 时只改这一个文件。
 */

export type RagContext = {
  chunks: { content: string; articleTitle: string | null; articleUrl: string | null }[];
};

/**
 * RAG 问答的 system prompt。
 * context 由 buildRagSystemPrompt() 注入，不写在此处。
 */
export const RAG_SYSTEM_BASE = `你是一个专注于用户 RSS 订阅内容的问答助手。
规则：
- 只基于下方【参考内容】回答，不引入外部知识。
- 无法从参考内容得出答案时，如实告知。
- 回答简洁、有条理，使用中文。
- 每条关键结论后用角标标注来源编号，如 [1]、[2]。`;

/**
 * 把检索到的 chunks 拼入 system prompt。
 * 与 RAG_SYSTEM_BASE 分离，便于单独测试 context 注入逻辑。
 */
export function buildRagSystemPrompt(ctx: RagContext): string {
  if (ctx.chunks.length === 0) {
    return RAG_SYSTEM_BASE + "\n\n【参考内容】\n（暂无匹配内容）";
  }

  const refs = ctx.chunks
    .map((c, i) => {
      const header = `[${i + 1}] ${c.articleTitle ?? "未知文章"}`;
      return `${header}\n${c.content.trim()}`;
    })
    .join("\n\n---\n\n");

  return `${RAG_SYSTEM_BASE}\n\n【参考内容】\n${refs}`;
}

/** 文章摘要生成（见 article-analysis.ts，此处存 system prompt 字符串供统一管理）。 */
export const ARTICLE_SUMMARY_SYSTEM =
  "你是单用户 RSS 阅读器的文章分析器。只基于给定文章证据输出摘要、要点、标签和重要度；不要引入外部事实。";

/** 每日 digest 生成 system prompt。 */
export const DIGEST_SYSTEM =
  "你是单用户 RSS 阅读器的每日摘要编辑。从给定高重要度文章中提炼跨文章洞见，输出结构化每日简报，使用中文，不引入外部知识。";
