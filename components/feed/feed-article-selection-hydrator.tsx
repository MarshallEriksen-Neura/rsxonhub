"use client";

import { useEffect } from "react";
import { useFeedStore } from "@/lib/stores/feed";

type FeedArticleSelectionHydratorProps = {
  initialArticleId: number | null;
};

export function FeedArticleSelectionHydrator({
  initialArticleId,
}: FeedArticleSelectionHydratorProps) {
  const selectArticle = useFeedStore((s) => s.selectArticle);

  useEffect(() => {
    selectArticle(initialArticleId);
  }, [initialArticleId, selectArticle]);

  return null;
}
