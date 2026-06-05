import { create } from "zustand";

/**
 * AI 摘要的展开状态。
 *
 * 这里只持有 UI 显隐状态。摘要内容必须来自 article_summaries;
 * 抓取到的源文本/summaryRaw 不能在这里伪装成 AI 摘要。
 *
 * 状态按 articleId 分桶持久在 store 里,这样切走再切回同一篇文章
 * 可以保留展开/折叠状态。
 */
interface AiSummaryState {
  /** articleId -> 摘要区是否展开。缺省视为 false(默认隐藏)。 */
  expanded: Record<number, boolean>;
  /** 该文章的摘要区是否展开。 */
  isExpanded: (id: number) => boolean;
  /** 切换摘要区显隐。 */
  toggle: (id: number) => void;
}

export const useAiSummaryStore = create<AiSummaryState>((set, get) => ({
  expanded: {},
  isExpanded: (id) => get().expanded[id] ?? false,
  toggle: (id) => {
    const willExpand = !get().isExpanded(id);
    set((s) => ({ expanded: { ...s.expanded, [id]: willExpand } }));
  },
}));
