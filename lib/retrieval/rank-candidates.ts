export type ArticleCandidate = {
  articleId: number;
  feedId: number;
  interestProfileVersion: number;
  rank: number;
  combinedScore: number;
  bm25Score: number;
  embeddingScore: number | null;
  recencyScore: number;
  sourceScore: number;
  features: Record<string, unknown>;
};

export type CandidateArticleRow = {
  articleId: number;
  feedId: number;
  title: string | null;
  content: string | null;
  summaryRaw: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  sourceMeta: Record<string, unknown> | null;
  weight: number | null;
};

export function rankArticleCandidates({
  rows,
  terms,
  profileVersion,
  embeddingScores,
  maxCandidates,
  perSourceLimit,
}: {
  rows: CandidateArticleRow[];
  terms: string[];
  profileVersion: number;
  embeddingScores: Map<number, number>;
  maxCandidates: number;
  perSourceLimit: number;
}): ArticleCandidate[] {
  const perSourceCounts = new Map<number, number>();

  return rows
    .map((row) => {
      const text = `${row.title ?? ""}\n${row.summaryRaw ?? ""}\n${row.content ?? ""}`;
      const bm25Score = lexicalScore(text, terms);
      const embeddingScore = embeddingScores.get(row.articleId) ?? null;
      const recencyScore = recencyScoreFor(row.publishedAt ?? row.fetchedAt);
      const sourceScore = Number(row.weight ?? 1);
      const routeRankBoost = rankBudgetBoost(row.sourceMeta);
      const combinedScore =
        bm25Score * 0.4 +
        (embeddingScore ?? 0) * 0.34 +
        recencyScore * 0.16 +
        sourceScore * 0.06 +
        routeRankBoost * 0.04;

      return {
        articleId: row.articleId,
        feedId: row.feedId,
        interestProfileVersion: profileVersion,
        rank: 0,
        combinedScore,
        bm25Score,
        embeddingScore,
        recencyScore,
        sourceScore,
        features: {
          termsMatched: matchedTerms(text, terms),
          routeRankBoost,
          sourceMeta: row.sourceMeta ?? {},
        },
      };
    })
    .filter(
      (candidate) =>
        candidate.bm25Score > 0 ||
        (candidate.embeddingScore ?? 0) > 0 ||
        candidate.recencyScore > 0.75,
    )
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .filter((candidate) => {
      const count = perSourceCounts.get(candidate.feedId) ?? 0;
      if (count >= perSourceLimit) return false;
      perSourceCounts.set(candidate.feedId, count + 1);
      return true;
    })
    .slice(0, maxCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function lexicalScore(text: string, terms: string[]) {
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  const hits = terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
  return hits / terms.length;
}

function matchedTerms(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term)).slice(0, 16);
}

function recencyScoreFor(date: Date | null) {
  if (!date) return 0;
  const ageHours = Math.max(0, Date.now() - date.getTime()) / 3_600_000;
  return Math.max(0, 1 - ageHours / (14 * 24));
}

function rankBudgetBoost(sourceMeta: Record<string, unknown> | null) {
  const rank = typeof sourceMeta?.rank === "number" ? sourceMeta.rank : null;
  if (!rank) return 0;
  if (rank <= 5) return 1;
  if (rank <= 20) return 0.5;
  return 0.15;
}
