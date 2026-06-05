import { create } from "zustand";

/**
 * Feed 工作区的客户端状态。
 * 业务数据来自 /api/feeds 与 /api/articles;这里仅缓存侧栏导航快照和 UI 选中态。
 */
export type FeedView = "all" | "unread" | "star";

export type FeedNavItem = {
  id: number;
  title: string;
  folder: string | null;
  unread: number;
};

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
  feeds: FeedNavItem[];
  /**
   * 显式创建、暂无订阅源的空分类。
   * 分类本身 = subscriptions.folder(自由文本),有源时从 feeds 聚合得到;
   * 空壳分类只作为本地 UI 辅助,不代表已持久化的业务实体。
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
  setFeeds: (feeds: FeedNavItem[]) => void;
  addFeed: (input: NewFeedInput) => FeedNavItem;
  /** 更新侧栏快照;持久化修改由 /api/feeds 负责。 */
  updateFeed: (id: number, patch: FeedPatch) => void;
  /** 从侧栏快照移除;持久化删除由 /api/feeds 负责。 */
  removeFeed: (id: number) => void;
  /** 新建一个本地空分类。已存在(无论有无源)则忽略。返回是否新建成功。 */
  addFolder: (name: string) => boolean;
  /** 重命名本地空分类,并同步已加载的侧栏快照。 */
  renameFolder: (from: string, to: string) => void;
  /** 删除本地空分类,并从已加载的侧栏快照移除该分类下的源。 */
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
    const feed: FeedNavItem = {
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