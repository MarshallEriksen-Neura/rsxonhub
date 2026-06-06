export const FEED_FETCH_STRATEGIES = ["auto", "direct", "rsshub", "browser"] as const;

export type FeedFetchStrategy = (typeof FEED_FETCH_STRATEGIES)[number];

export const DEFAULT_FEED_FETCH_STRATEGY: FeedFetchStrategy = "auto";

export function normalizeFeedFetchStrategy(value: unknown): FeedFetchStrategy {
  return FEED_FETCH_STRATEGIES.includes(value as FeedFetchStrategy)
    ? (value as FeedFetchStrategy)
    : DEFAULT_FEED_FETCH_STRATEGY;
}

export function feedFetchStrategyLabel(strategy: FeedFetchStrategy) {
  switch (strategy) {
    case "direct":
      return "直连";
    case "rsshub":
      return "RSSHub";
    case "browser":
      return "浏览器";
    case "auto":
      return "自动";
  }
}
