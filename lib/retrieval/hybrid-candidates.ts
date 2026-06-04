import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articleRelevanceScores,
  articles,
  digestCandidates,
  feeds,
  subscriptions,
} from "@/lib/db/schema";
import {
  getActiveInterestProfile,
  tokenizeInterest,
  type ActiveInterestProfile,
} from "@/lib/interests/profile";

export type CandidateSelectionOptions = {
  digestDate?: string;
  maxCandidates?: number;
  recencyDays?: number;
  perSourceLimit?: number;
};

export type ArticleCandidate = {
  articleId: number;
  feedId: number;
  interestProfileVersion: number;
  rank: number;
  combinedScore: number;
  bm25Score: number;
  recencyScore: number;
  sourceScore: number;
  features: Record<string, unknown>;
};

export async function selectDigestCandidates(options: CandidateSelectionOptions = {}) {
  const profile = await getActiveInterestProfile();
  if (!profile) {
    return [];
  }

  const candidates = await scoreCandidates(profile, options);
  await persistCandidateScores(candidates);

  const digestDate = options.digestDate ?? todayKey();
  await persistDigestCandidates(digestDate, candidates);

  return candidates;
}

export async function scoreCandidates(
  profile: ActiveInterestProfile,
  options: CandidateSelectionOptions = {},
): Promise<ArticleCandidate[]> {
  const maxCandidates = options.maxCandidates ?? 50;
  const recencyDays = options.recencyDays ?? 14;
  const perSourceLimit = options.perSourceLimit ?? 12;
  const terms = tokenizeInterest(profile.content);
  const since = new Date(Date.now() - recencyDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      articleId: articles.id,
      feedId: articles.feedId,
      title: articles.title,
      content: articles.content,
      summaryRaw: articles.summaryRaw,
      publishedAt: articles.publishedAt,
      fetchedAt: articles.fetchedAt,
      sourceMeta: articles.sourceMeta,
      weight: subscriptions.weight,
    })
    .from(articles)
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
    .where(gte(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`, since))
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
    .limit(500);

  const perSourceCounts = new Map<number, number>();

  return rows
    .map((row) => {
      const text = `${row.title ?? ""}\n${row.summaryRaw ?? ""}\n${row.content ?? ""}`;
      const bm25Score = lexicalScore(text, terms);
      const recencyScore = recencyScoreFor(row.publishedAt ?? row.fetchedAt);
      const sourceScore = Number(row.weight ?? 1);
      const routeRankBoost = rankBudgetBoost(row.sourceMeta);
      const combinedScore =
        bm25Score * 0.58 + recencyScore * 0.22 + sourceScore * 0.12 + routeRankBoost * 0.08;

      return {
        articleId: row.articleId,
        feedId: row.feedId,
        interestProfileVersion: profile.version,
        rank: 0,
        combinedScore,
        bm25Score,
        recencyScore,
        sourceScore,
        features: {
          termsMatched: matchedTerms(text, terms),
          routeRankBoost,
          sourceMeta: row.sourceMeta ?? {},
        },
      };
    })
    .filter((candidate) => candidate.bm25Score > 0 || candidate.recencyScore > 0.75)
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

export async function persistCandidateScores(candidates: ArticleCandidate[]) {
  if (candidates.length === 0) return;

  await db.transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx
        .insert(articleRelevanceScores)
        .values({
          articleId: candidate.articleId,
          interestProfileVersion: candidate.interestProfileVersion,
          bm25Score: candidate.bm25Score,
          embeddingScore: null,
          recencyScore: candidate.recencyScore,
          sourceScore: candidate.sourceScore,
          combinedScore: candidate.combinedScore,
          features: candidate.features,
        })
        .onConflictDoUpdate({
          target: [
            articleRelevanceScores.articleId,
            articleRelevanceScores.interestProfileVersion,
          ],
          set: {
            bm25Score: candidate.bm25Score,
            recencyScore: candidate.recencyScore,
            sourceScore: candidate.sourceScore,
            combinedScore: candidate.combinedScore,
            features: candidate.features,
            createdAt: sql`now()`,
          },
        });
    }
  });
}

async function persistDigestCandidates(digestDate: string, candidates: ArticleCandidate[]) {
  if (candidates.length === 0) return;

  await db.transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx
        .insert(digestCandidates)
        .values({
          digestDate,
          articleId: candidate.articleId,
          interestProfileVersion: candidate.interestProfileVersion,
          retrievalRank: candidate.rank,
          selectionStage: "retrieval",
          scoreSnapshot: {
            combinedScore: candidate.combinedScore,
            bm25Score: candidate.bm25Score,
            recencyScore: candidate.recencyScore,
            sourceScore: candidate.sourceScore,
            features: candidate.features,
          },
        })
        .onConflictDoUpdate({
          target: [digestCandidates.digestDate, digestCandidates.articleId],
          set: {
            interestProfileVersion: candidate.interestProfileVersion,
            retrievalRank: candidate.rank,
            selectionStage: "retrieval",
            scoreSnapshot: {
              combinedScore: candidate.combinedScore,
              bm25Score: candidate.bm25Score,
              recencyScore: candidate.recencyScore,
              sourceScore: candidate.sourceScore,
              features: candidate.features,
            },
            createdAt: sql`now()`,
          },
        });
    }
  });
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
