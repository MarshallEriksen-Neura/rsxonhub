export const JOB_NAMES = {
  feedFetchDue: "feed.fetch-due",
  feedFetchOne: "feed.fetch-one",
  articleAnalyze: "article.analyze",
  articleEmbed: "article.embed",
  digestPrepareDaily: "digest.prepare-daily",
  digestGenerateDaily: "digest.generate-daily",
} as const;

export type FeedFetchOneJob = {
  feedId: number;
};

export type ArticleAnalyzeJob = {
  articleId: number;
};

export type ArticleEmbedJob = {
  articleId?: number;
  rebuildRunId?: number;
};

export type DigestGenerateDailyJob = {
  digestDate?: string;
  interestProfileVersion?: number;
  runId?: number;
};

export type DigestPrepareDailyJob = {
  digestDate?: string;
  interestProfileVersion?: number;
  runId?: number;
};
