import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, digestRuns, digests } from "@/lib/db/schema";

export type DigestRunPhase = "prepare" | "generate";
export type DigestRunStatus = "pending" | "running" | "success" | "failed" | "skipped";

export async function createDigestRun(input: {
  digestDate: string;
  interestProfileVersion: number;
  phase: DigestRunPhase;
  status?: DigestRunStatus;
  jobId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(digestRuns)
    .values({
      digestDate: input.digestDate,
      interestProfileVersion: input.interestProfileVersion,
      phase: input.phase,
      status: input.status ?? "pending",
      jobId: input.jobId,
      error: input.error,
      metadata: input.metadata,
      startedAt: input.status === "running" ? sql`now()` : null,
      finishedAt:
        input.status === "success" ||
        input.status === "failed" ||
        input.status === "skipped"
          ? sql`now()`
          : null,
      updatedAt: sql`now()`,
    })
    .returning();

  return row;
}

export async function markDigestRunRunning(runId: number) {
  await db
    .update(digestRuns)
    .set({ status: "running", startedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(digestRuns.id, runId));
}

export async function attachDigestRunJob(runId: number, jobId: string | null) {
  await db
    .update(digestRuns)
    .set({ jobId, updatedAt: sql`now()` })
    .where(eq(digestRuns.id, runId));
}

export async function markDigestRunFinished(
  runId: number,
  input: {
    status: Extract<DigestRunStatus, "success" | "failed" | "skipped">;
    error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await db
    .update(digestRuns)
    .set({
      status: input.status,
      error: input.error,
      metadata: input.metadata,
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(digestRuns.id, runId));
}

export async function hasSuccessfulDigest(input: {
  digestDate: string;
  interestProfileVersion: number;
}) {
  const [row] = await db
    .select({ id: digests.id })
    .from(digests)
    .where(
      and(
        eq(digests.digestDate, input.digestDate),
        eq(digests.interestProfileVersion, input.interestProfileVersion),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function hasCompletedDigestRun(input: {
  digestDate: string;
  interestProfileVersion: number;
  phase: DigestRunPhase;
  statuses?: DigestRunStatus[];
}) {
  const statuses = input.statuses ?? ["success"];
  const [row] = await db
    .select({ id: digestRuns.id })
    .from(digestRuns)
    .where(
      and(
        eq(digestRuns.digestDate, input.digestDate),
        eq(digestRuns.interestProfileVersion, input.interestProfileVersion),
        eq(digestRuns.phase, input.phase),
        inArray(digestRuns.status, statuses),
      ),
    )
    .orderBy(desc(digestRuns.createdAt))
    .limit(1);

  return Boolean(row);
}

export async function getLatestDigestRun(digestDate?: string) {
  const where = digestDate ? eq(digestRuns.digestDate, digestDate) : undefined;
  const [row] = await db
    .select()
    .from(digestRuns)
    .where(where)
    .orderBy(desc(digestRuns.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getLatestDigestStatus(digestDate: string) {
  const latestRun = await getLatestDigestRun(digestDate);
  const [digest] = await db
    .select({
      id: digests.id,
      digestDate: digests.digestDate,
      interestProfileVersion: digests.interestProfileVersion,
      model: digests.model,
      tokenCost: digests.tokenCost,
      updatedAt: digests.updatedAt,
      selectedCount: sql<number>`count(${digestItems.id})::int`,
    })
    .from(digests)
    .leftJoin(digestItems, eq(digestItems.digestId, digests.id))
    .where(eq(digests.digestDate, digestDate))
    .groupBy(digests.id)
    .orderBy(desc(digests.updatedAt))
    .limit(1);

  return {
    latestRun,
    digest: digest ?? null,
  };
}

export function normalizeRunError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
