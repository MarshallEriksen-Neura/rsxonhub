import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatState {
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  /** 当前在侧边栏预览的文章 ID，null 表示关闭 */
  previewArticleId: number | null;
  setPreviewArticleId: (id: number | null) => void;
  /** 当前高亮的引用角标索引（0-based），-1 表示无高亮 */
  highlightedCitationIdx: number;
  setHighlightedCitationIdx: (idx: number) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      selectedModel: null,
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      activeSessionId: null,
      setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
      previewArticleId: null,
      setPreviewArticleId: (previewArticleId) => set({ previewArticleId }),
      highlightedCitationIdx: -1,
      setHighlightedCitationIdx: (highlightedCitationIdx) => set({ highlightedCitationIdx }),
    }),
    {
      name: "rsxonhub-chat",
      // 只持久化跨刷新仍有意义的状态，临时 UI 状态不持久化。
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        activeSessionId: state.activeSessionId,
      }),
    },
  ),
);
