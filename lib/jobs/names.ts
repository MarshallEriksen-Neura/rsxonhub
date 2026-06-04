export const JOB_NAMES = {
  feedFetchDue: "feed.fetch-due",
  feedFetchOne: "feed.fetch-one",
  articleAnalyze: "article.analyze",
  articleEmbed: "article.embed",
  digestGenerateDaily: "digest.generate-daily",
} as const;

export type FeedFetchOneJob = {
  feedId: number;
};

export type ArticleAnalyzeJob = {
  articleId: number;
};
