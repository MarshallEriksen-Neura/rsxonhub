import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { interestProfiles } from "@/lib/db/schema";
import { stableHash } from "@/lib/rss/hash";

export type ActiveInterestProfile = {
  id: number;
  content: string;
  contentHash: string;
  version: number;
};

export async function getActiveInterestProfile() {
  const [profile] = await db
    .select({
      id: interestProfiles.id,
      content: interestProfiles.content,
      contentHash: interestProfiles.contentHash,
      version: interestProfiles.version,
    })
    .from(interestProfiles)
    .where(eq(interestProfiles.isActive, 1))
    .orderBy(desc(interestProfiles.version))
    .limit(1);

  return profile ?? null;
}

export async function saveInterestProfile(content: string) {
  const normalized = content.trim();
  if (!normalized) {
    throw new Error("兴趣画像不能为空。");
  }

  const contentHash = stableHash(normalized);
  const current = await getActiveInterestProfile();
  if (current?.contentHash === contentHash) {
    return { profile: current, changed: false };
  }

  const [maxVersionRow] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${interestProfiles.version}), 0)` })
    .from(interestProfiles);
  const nextVersion = Number(maxVersionRow?.maxVersion ?? 0) + 1;

  const [profile] = await db.transaction(async (tx) => {
    await tx.update(interestProfiles).set({ isActive: 0 }).where(eq(interestProfiles.isActive, 1));

    return tx
      .insert(interestProfiles)
      .values({
        content: normalized,
        contentHash,
        version: nextVersion,
        isActive: 1,
        updatedAt: sql`now()`,
      })
      .returning({
        id: interestProfiles.id,
        content: interestProfiles.content,
        contentHash: interestProfiles.contentHash,
        version: interestProfiles.version,
      });
  });

  return { profile, changed: true };
}

export function tokenizeInterest(content: string) {
  return Array.from(
    new Set(
      content
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  ).slice(0, 64);
}
