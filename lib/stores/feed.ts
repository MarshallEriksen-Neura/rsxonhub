import { create } from "zustand";
import { type FeedView, type MockFeed } from "@/lib/mock/feed";

/**
 * Feed 工作区的客户端状态。
 * - UI 选中态(view / selectedFeedId / selectedArticleId / search):纯前端,不缓存业务数据。
 * - feeds:布局阶段用 mockFeeds 持有,以便"添加订阅源"能即时反映到侧栏。
 *   后端接入后,feeds 改由 RSC/API 提供,addFeed 改为调用写 API(见 DESIGN.md §订阅)。
 */
export type NewFeedInput = {
  id?: number;
  title: string;
  folder: string;
  url: string;
};

export type FeedPatch = {
  title?: string;
  folder?: string;
};

interface FeedState {
  feeds: MockFeed[];
  /**
   * 显式创建、暂无订阅源的空分类。
   * 分类本身 = subscriptions.folder(自由文本),有源时从 feeds 聚合得到;
   * 但用户可以先建一个空分类、之后再往里加源,所以这些"空壳"单独记在这里。
   * 某分类一旦有源进驻,UI 聚合时会与此列表去重。
   */
  folders: string[];
  view: FeedView;
  selectedFeedId: number | null;
  selectedArticleId: number | null;
  search: string;
  setView: (view: FeedView) => void;
  selectFeed: (id: number | null) => void;
  selectArticle: (id: number | null) => void;
  setSearch: (q: string) => void;
  setFeeds: (feeds: MockFeed[]) => void;
  addFeed: (input: NewFeedInput) => MockFeed;
  /** 编辑订阅源标题 / 所属分类。 */
  updateFeed: (id: number, patch: FeedPatch) => void;
  /** 退订单个源。选中态若指向它则清空。 */
  removeFeed: (id: number) => void;
  /** 新建一个空分类。已存在(无论有无源)则忽略。返回是否新建成功。 */
  addFolder: (name: string) => boolean;
  /** 重命名分类:把该 folder 下所有源迁到新名,空壳列表同步。 */
  renameFolder: (from: string, to: string) => void;
  /** 删除分类:其下所有源一并退订(危险操作,UI 需二次确认)。 */
  deleteFolder: (folder: string) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  feeds: [],
  folders: [],
  view: "all",
  selectedFeedId: null,
  selectedArticleId: null,
  search: "",
  setView: (view) => set({ view, selectedArticleId: null }),
  selectFeed: (id) => set({ selectedFeedId: id, selectedArticleId: null }),
  selectArticle: (id) => set({ selectedArticleId: id }),
  setSearch: (search) => set({ search }),
  setFeeds: (feeds) => set({ feeds }),
  addFeed: (input) => {
    const feeds = get().feeds;
    const nextId = input.id ?? feeds.reduce((max, f) => Math.max(max, f.id), 0) + 1;
    // url 暂不进 MockFeed(侧栏只显示 title/folder/unread);真实抓取接入后由 feeds 表持有。
    const feed: MockFeed = {
      id: nextId,
      title: input.title.trim() || hostFromUrl(input.url),
      folder: input.folder.trim() || null,
      unread: 0,
    };
    set({ feeds: [...feeds, feed] });
    return feed;
  },
  updateFeed: (id, patch) =>
    set((state) => ({
      feeds: state.feeds.map((f) =>
        f.id === id
          ? {
              ...f,
              title: patch.title?.trim() ? patch.title.trim() : f.title,
              folder:
                patch.folder !== undefined
                  ? patch.folder.trim() || null
                  : f.folder,
            }
          : f,
      ),
    })),
  removeFeed: (id) =>
    set((state) => ({
      feeds: state.feeds.filter((f) => f.id !== id),
      selectedFeedId: state.selectedFeedId === id ? null : state.selectedFeedId,
    })),
  addFolder: (name) => {
    const next = name.trim();
    if (!next) return false;
    const state = get();
    const existing = new Set<string>(state.folders);
    for (const f of state.feeds) if (f.folder) existing.add(f.folder);
    if (existing.has(next)) return false;
    set({ folders: [...state.folders, next] });
    return true;
  },
  renameFolder: (from, to) => {
    const next = to.trim();
    if (!next || next === from) return;
    set((state) => ({
      feeds: state.feeds.map((f) =>
        f.folder === from ? { ...f, folder: next } : f,
      ),
      // 同名合并:去重后落地新名
      folders: dedupe(
        state.folders.map((name) => (name === from ? next : name)),
      ),
    }));
  },
  deleteFolder: (folder) =>
    set((state) => {
      const removed = new Set(
        state.feeds.filter((f) => f.folder === folder).map((f) => f.id),
      );
      return {
        feeds: state.feeds.filter((f) => f.folder !== folder),
        folders: state.folders.filter((name) => name !== folder),
        selectedFeedId:
          state.selectedFeedId && removed.has(state.selectedFeedId)
            ? null
            : state.selectedFeedId,
      };
    }),
}));

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
