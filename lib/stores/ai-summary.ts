import { create } from "zustand";

/**
 * AI 摘要的按需加载状态(纯前端模拟)。
 *
 * 文章详情默认不展示 AI 摘要,用户点击触发按钮后才"请求"后端。
 * 这里只持有 UI 状态机,真实接入后 request() 改为调用 /api 拉取摘要
 * (见 DESIGN.md · article_summaries 与 AI 产物独立于原文)。
 *
 * 状态按 articleId 分桶持久在 store 里,这样切走再切回同一篇文章
 * 不会重复"请求",已加载的摘要直接复现。
 */
export type SummaryStatus = "idle" | "loading" | "ready";

/** 模拟后端往返耗时(ms)。 */
const FAKE_LATENCY_MS = 1200;

interface AiSummaryState {
  /** articleId -> 加载状态。缺省视为 idle。 */
  status: Record<number, SummaryStatus>;
  /** articleId -> 摘要区是否展开。缺省视为 false(默认隐藏)。 */
  expanded: Record<number, boolean>;
  /** 读取某篇文章的加载状态。 */
  statusOf: (id: number) => SummaryStatus;
  /** 该文章的摘要区是否展开。 */
  isExpanded: (id: number) => boolean;
  /**
   * 切换摘要区显隐。
   * 首次展开且仍为 idle 时触发一次"请求"(loading -> ready)。
   */
  toggle: (id: number) => void;
}

export const useAiSummaryStore = create<AiSummaryState>((set, get) => ({
  status: {},
  expanded: {},
  statusOf: (id) => get().status[id] ?? "idle",
  isExpanded: (id) => get().expanded[id] ?? false,
  toggle: (id) => {
    const willExpand = !get().isExpanded(id);
    set((s) => ({ expanded: { ...s.expanded, [id]: willExpand } }));

    // 仅在首次展开、尚未加载过时发起"请求"。
    if (willExpand && get().statusOf(id) === "idle") {
      set((s) => ({ status: { ...s.status, [id]: "loading" } }));
      setTimeout(() => {
        set((s) => ({ status: { ...s.status, [id]: "ready" } }));
      }, FAKE_LATENCY_MS);
    }
  },
}));
