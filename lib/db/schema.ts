import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";

/**
 * 数据模型,见 docs/product-design.md §5。
 * 单用户:不带 user_id。原文(articles)与 AI 产物(summaries/chunks)拆开,
 * 便于重算、控成本、AI 失败不影响抓取。
 */

// 单账户登录用,仅一行
export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// AI 运行时配置。单用户:chat 与 embedding 各一行。
export const aiConfigs = pgTable(
  "ai_configs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind", { enum: ["chat", "embedding"] }).notNull(),
    baseUrl: text("base_url").notNull(),
    apiKey: text("api_key"),
    model: text("model").notNull(),
    temperature: real("temperature"),
    dimension: integer("dimension"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ai_configs_kind_idx").on(t.kind)],
);

// AI 模型候选目录。由设置页成功拉取 /models 后缓存,用于重新打开页面时恢复快捷选择。
export const aiModelPresets = pgTable(
  "ai_model_presets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind", { enum: ["chat", "embedding"] }).notNull(),
    baseUrl: text("base_url").notNull(),
    model: text("model").notNull(),
    supportsChat: boolean("supports_chat").default(false).notNull(),
    supportsEmbedding: boolean("supports_embedding")
      .default(false)
      .notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ai_model_presets_kind_base_model_idx").on(t.kind, t.baseUrl, t.model),
    index("ai_model_presets_kind_base_idx").on(t.kind, t.baseUrl),
  ],
);

// RSS 源
export const feeds = pgTable("feeds", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  url: text("url").notNull().unique(),
  sourceType: text("source_type", { enum: ["rsshub", "http"] }).notNull().default("http"),
  sourceMeta: jsonb("source_meta").$type<Record<string, unknown>>(),
  title: text("title"),
  siteUrl: text("site_url"),
  fetchInterval: integer("fetch_interval").default(3600).notNull(), // 秒
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastSuccessfulFetchedAt: timestamp("last_successful_fetched_at", { withTimezone: true }),
  etag: text("etag"),
  lastModified: text("last_modified"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 订阅关系(分组 + 权重)
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    folder: text("folder"),
    weight: real("weight").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("subscriptions_feed_idx").on(t.feedId)],
);

// 条目。(feed_id, guid) 唯一用于去重
export const articles = pgTable(
  "articles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    guid: text("guid").notNull(),
    title: text("title"),
    contentHash: text("content_hash"),
    content: text("content"),
    summaryRaw: text("summary_raw"), // 源自带的 description/summary
    url: text("url"),
    imageUrl: text("image_url"), // 仅展示,不向量化
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourceMeta: jsonb("source_meta").$type<Record<string, unknown>>(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("articles_feed_guid_idx").on(t.feedId, t.guid),
    index("articles_published_idx").on(t.publishedAt),
  ],
);

// AI 产物:摘要 / 要点 / 标签 / 重要性。挂 article 上,算一次
export const articleSummaries = pgTable("article_summaries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" })
    .unique(),
  summary: text("summary"),
  bullets: jsonb("bullets").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>(),
  importance: integer("importance"), // 0-100
  status: text("status", { enum: ["pending", "complete", "failed"] })
    .default("pending")
    .notNull(),
  contentHash: text("content_hash"),
  promptVersion: text("prompt_version"),
  model: text("model"),
  tokenCost: integer("token_cost"),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 向量。维度由 DEFAULT_EMBEDDING_DIM 决定;运行时模型配置从 ai_configs 读取。
export const articleChunks = pgTable(
  "article_chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: DEFAULT_EMBEDDING_DIM }),
  },
  (t) => [
    uniqueIndex("article_chunks_article_chunk_idx").on(t.articleId, t.chunkIndex),
  ],
);

// 阅读态
export const readStates = pgTable("read_states", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" })
    .unique(),
  status: text("status", { enum: ["unread", "read", "star", "later"] })
    .default("unread")
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 对话
export const conversations = pgTable("conversations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 消息(带引用回溯)
export const messages = pgTable("messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  citedArticleIds: jsonb("cited_article_ids").$type<number[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 用量(观测花销)
export const usageLogs = pgTable("usage_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  kind: text("kind").notNull(), // summary | digest | embedding | chat
  model: text("model"),
  tokens: integer("tokens"),
  cost: real("cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interestProfiles = pgTable(
  "interest_profiles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: DEFAULT_EMBEDDING_DIM }),
    version: integer("version").notNull(),
    isActive: integer("is_active").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("interest_profiles_version_idx").on(t.version)],
);

export const articleRelevanceScores = pgTable(
  "article_relevance_scores",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    interestProfileVersion: integer("interest_profile_version").notNull(),
    bm25Score: real("bm25_score"),
    embeddingScore: real("embedding_score"),
    recencyScore: real("recency_score"),
    sourceScore: real("source_score"),
    combinedScore: real("combined_score").notNull(),
    features: jsonb("features").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("article_relevance_article_profile_idx").on(
      t.articleId,
      t.interestProfileVersion,
    ),
    index("article_relevance_combined_idx").on(t.combinedScore),
  ],
);

export const digestCandidates = pgTable(
  "digest_candidates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    digestDate: text("digest_date").notNull(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    interestProfileVersion: integer("interest_profile_version").notNull(),
    retrievalRank: integer("retrieval_rank").notNull(),
    selectionStage: text("selection_stage").notNull(),
    scoreSnapshot: jsonb("score_snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("digest_candidates_date_article_idx").on(t.digestDate, t.articleId),
  ],
);

export const feedFetchRuns = pgTable("feed_fetch_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  feedId: integer("feed_id")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status", { enum: ["running", "success", "failed"] })
    .default("running")
    .notNull(),
  itemCount: integer("item_count").default(0).notNull(),
  insertedCount: integer("inserted_count").default(0).notNull(),
  updatedCount: integer("updated_count").default(0).notNull(),
  error: text("error"),
});

export const embeddingRebuildRuns = pgTable("embedding_rebuild_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  status: text("status", { enum: ["pending", "running", "complete", "failed"] })
    .default("pending")
    .notNull(),
  model: text("model").notNull(),
  baseUrl: text("base_url").notNull(),
  dimension: integer("dimension").notNull(),
  articleCount: integer("article_count").default(0).notNull(),
  chunkCount: integer("chunk_count").default(0).notNull(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const digests = pgTable(
  "digests",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    digestDate: text("digest_date").notNull(),
    interestProfileVersion: integer("interest_profile_version").notNull(),
    title: text("title"),
    summary: text("summary"),
    model: text("model"),
    tokenCost: integer("token_cost"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("digests_date_profile_idx").on(t.digestDate, t.interestProfileVersion)],
);

export const digestItems = pgTable(
  "digest_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    digestId: integer("digest_id")
      .notNull()
      .references(() => digests.id, { onDelete: "cascade" }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reason: text("reason"),
    scoreSnapshot: jsonb("score_snapshot").$type<Record<string, unknown>>(),
  },
  (t) => [uniqueIndex("digest_items_digest_article_idx").on(t.digestId, t.articleId)],
);

export const schema = {
  users,
  aiConfigs,
  aiModelPresets,
  feeds,
  subscriptions,
  articles,
  articleSummaries,
  articleChunks,
  readStates,
  conversations,
  messages,
  usageLogs,
  interestProfiles,
  articleRelevanceScores,
  digestCandidates,
  feedFetchRuns,
  embeddingRebuildRuns,
  digests,
  digestItems,
};

// 提供 pgvector 扩展开启语句,迁移前需先执行
export const ENABLE_PGVECTOR = sql`CREATE EXTENSION IF NOT EXISTS vector;`;
