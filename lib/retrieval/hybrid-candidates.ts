import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articleChunks,
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
import { rankArticleCandidates, type ArticleCandidate } from "@/lib/retrieval/rank-candidates";

export type CandidateSelectionOptions = {
  digestDate?: string;
  maxCandidates?: number;
  recencyDays?: number;
  perSourceLimit?: number;
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
  const sinceTimestamp = since.toISOString();
  const articleTimestamp = sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`;

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
    .where(sql`${articleTimestamp} >= ${sinceTimestamp}::timestamptz`)
    .orderBy(desc(articleTimestamp))
    .limit(500);

  const embeddingScores = profile.embedding
    ? await loadEmbeddingScores(profile.embedding, sinceTimestamp)
    : new Map<number, number>();

  return rankArticleCandidates({
    rows,
    terms,
    profileVersion: profile.version,
    embeddingScores,
    maxCandidates,
    perSourceLimit,
  });
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
          embeddingScore: candidate.embeddingScore,
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
            embeddingScore: candidate.embeddingScore,
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
          scoreSnapshot: scoreSnapshot(candidate),
        })
        .onConflictDoUpdate({
          target: [digestCandidates.digestDate, digestCandidates.articleId],
          set: {
            interestProfileVersion: candidate.interestProfileVersion,
            retrievalRank: candidate.rank,
            selectionStage: "retrieval",
            scoreSnapshot: scoreSnapshot(candidate),
            createdAt: sql`now()`,
          },
        });
    }
  });
}

async function loadEmbeddingScores(embedding: number[], sinceTimestamp: string) {
  const vector = JSON.stringify(embedding);
  const rows = await db
    .select({
      articleId: articleChunks.articleId,
      distance: sql<number>`min(${articleChunks.embedding} <=> ${vector}::vector)`,
    })
    .from(articleChunks)
    .innerJoin(articles, eq(articles.id, articleChunks.articleId))
    .where(
      sql`${articleChunks.embedding} is not null
        and coalesce(${articles.publishedAt}, ${articles.fetchedAt}) >= ${sinceTimestamp}::timestamptz`,
    )
    .groupBy(articleChunks.articleId)
    .orderBy(sql`min(${articleChunks.embedding} <=> ${vector}::vector)`)
    .limit(500);

  return new Map(
    rows.map((row) => [row.articleId, distanceToEmbeddingScore(Number(row.distance))]),
  );
}

function scoreSnapshot(candidate: ArticleCandidate) {
  return {
    combinedScore: candidate.combinedScore,
    bm25Score: candidate.bm25Score,
    embeddingScore: candidate.embeddingScore,
    recencyScore: candidate.recencyScore,
    sourceScore: candidate.sourceScore,
    features: candidate.features,
  };
}

function distanceToEmbeddingScore(distance: number) {
  if (!Number.isFinite(distance)) return 0;
  return 1 / (1 + Math.max(0, distance));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
