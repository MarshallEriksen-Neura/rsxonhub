import { create } from "zustand";
import type { FeedView } from "@/lib/mock/feed";

/**
 * Feed 工作区的交互态(纯客户端):当前视图过滤、当前选中文章、移动端栏切换。
 * 服务端数据走 RSC / API,这里只管 UI 选中态,不缓存业务数据。
 */
interface FeedState {
  view: FeedView;
  selectedFeedId: number | null;
  selectedArticleId: number | null;
  search: string;
  setView: (view: FeedView) => void;
  selectFeed: (id: number | null) => void;
  selectArticle: (id: number | null) => void;
  setSearch: (q: string) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  view: "all",
  selectedFeedId: null,
  selectedArticleId: null,
  search: "",
  setView: (view) => set({ view, selectedArticleId: null }),
  selectFeed: (id) => set({ selectedFeedId: id, selectedArticleId: null }),
  selectArticle: (id) => set({ selectedArticleId: id }),
  setSearch: (search) => set({ search }),
}));
