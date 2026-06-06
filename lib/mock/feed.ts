/**
 * 布局阶段的占位数据。后端(rss-parser + AI 摘要)接入后整体替换为 DB 查询。
 * 形状刻意贴合 lib/db/schema.ts,迁移时改动最小。
 */

export type Importance = "high" | "medium" | "low" | "unknown";

export type MockArticle = {
  id: number;
  feedId: number;
  feedTitle: string;
  title: string;
  url: string;
  author: string | null;
  publishedAt: string; // ISO
  imageUrl: string | null;
  summary: string;
  bullets: string[];
  tags: string[];
  importance: Importance;
  status: "unread" | "read" | "star" | "later";
  content: string;
};

export type MockFeed = {
  id: number;
  title: string;
  folder: string | null;
  unread: number;
};

export type FeedView = "all" | "unread" | "star" | "digest";

export const mockFeeds: MockFeed[] = [
  { id: 1, title: "Hacker News", folder: "科技", unread: 12 },
  { id: 2, title: "Stratechery", folder: "科技", unread: 3 },
  { id: 3, title: "少数派", folder: "中文", unread: 7 },
  { id: 4, title: "阮一峰的网络日志", folder: "中文", unread: 1 },
  { id: 5, title: "The Verge", folder: "科技", unread: 0 },
  { id: 6, title: "Nature News", folder: "科研", unread: 4 },
];

export const mockArticles: MockArticle[] = [
  {
    id: 101,
    feedId: 2,
    feedTitle: "Stratechery",
    title: "The End of the Beginning for AI Platforms",
    url: "https://example.com/a/101",
    author: "Ben Thompson",
    publishedAt: "2026-06-04T08:12:00Z",
    imageUrl: null,
    summary:
      "AI 平台之争从模型能力转向分发与集成,谁掌握用户入口谁定义下一阶段竞争。",
    bullets: [
      "模型差距收窄,护城河转向分发渠道",
      "集成深度比单点能力更决定留存",
      "开放生态与封闭体验出现再平衡",
    ],
    tags: ["AI", "平台战略", "深度"],
    importance: "high",
    status: "unread",
    content:
      "完整正文在后端接入后由 articles.content 提供。此处为布局占位文本,用于验证详情栏的排版、行宽与滚动行为。",
  },
  {
    id: 102,
    feedId: 1,
    feedTitle: "Hacker News",
    title: "Show HN: 我用 pgvector 给个人 RSS 做了语义检索",
    url: "https://example.com/a/102",
    author: null,
    publishedAt: "2026-06-04T06:40:00Z",
    imageUrl: null,
    summary: "单用户场景下 pgvector + 小模型 embedding 足以支撑全库语义问答,成本可控。",
    bullets: ["维度需在建表前实测锁定", "input_type 区分 passage/query"],
    tags: ["pgvector", "RAG"],
    importance: "medium",
    status: "unread",
    content: "布局占位正文。",
  },
  {
    id: 103,
    feedId: 3,
    feedTitle: "少数派",
    title: "重新整理我的信息流:从订阅过载到每日精选",
    url: "https://example.com/a/103",
    author: "派友",
    publishedAt: "2026-06-03T14:05:00Z",
    imageUrl: null,
    summary: "用重要度评分与每日 digest 替代无限滚动,把阅读时间花在高价值内容上。",
    bullets: ["重要度评分过滤噪音", "每日精选替代信息流焦虑"],
    tags: ["效率", "信息管理"],
    importance: "medium",
    status: "read",
    content: "布局占位正文。",
  },
  {
    id: 104,
    feedId: 6,
    feedTitle: "Nature News",
    title: "A new approach to long-context retrieval evaluation",
    url: "https://example.com/a/104",
    author: "Editorial",
    publishedAt: "2026-06-03T09:00:00Z",
    imageUrl: null,
    summary: "长上下文检索的评测基准更新,强调引用准确率而非单纯召回。",
    bullets: ["引用准确率成为新核心指标"],
    tags: ["科研", "检索"],
    importance: "low",
    status: "star",
    content: "布局占位正文。",
  },
];

export function articlesForView(view: FeedView): MockArticle[] {
  switch (view) {
    case "unread":
      return mockArticles.filter((a) => a.status === "unread");
    case "star":
      return mockArticles.filter((a) => a.status === "star");
    case "digest":
      return mockArticles.filter((a) => a.importance === "high");
    default:
      return mockArticles;
  }
}
