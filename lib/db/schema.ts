import { sql } from "drizzle-orm";
import {
  bigserial,
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
import { env } from "@/lib/env";

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

// RSS 源
export const feeds = pgTable("feeds", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title"),
  siteUrl: text("site_url"),
  fetchInterval: integer("fetch_interval").default(3600).notNull(), // 秒
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 订阅关系(分组 + 权重)
export const subscriptions = pgTable("subscriptions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  feedId: integer("feed_id")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  folder: text("folder"),
  weight: real("weight").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    content: text("content"),
    summaryRaw: text("summary_raw"), // 源自带的 description/summary
    url: text("url"),
    imageUrl: text("image_url"), // 仅展示,不向量化
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
  model: text("model"),
  tokenCost: integer("token_cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 向量。维度由 EMBEDDING_DIM 决定(见 §6 坑 1)
export const articleChunks = pgTable(
  "article_chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: env.EMBEDDING_DIM }),
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

export const schema = {
  users,
  feeds,
  subscriptions,
  articles,
  articleSummaries,
  articleChunks,
  readStates,
  conversations,
  messages,
  usageLogs,
};

// 提供 pgvector 扩展开启语句,迁移前需先执行
export const ENABLE_PGVECTOR = sql`CREATE EXTENSION IF NOT EXISTS vector;`;
