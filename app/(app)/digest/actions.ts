"use server";

import { revalidatePath } from "next/cache";
import { getScheduleLocalDate } from "@/lib/datetime";
import { env } from "@/lib/env";
import {
  enqueueDailyDigest,
  enqueueDailyDigestPreparation,
} from "@/lib/jobs/feed-jobs";

export async function regenerateTodayDigest() {
  await enqueueDailyDigest({ digestDate: getScheduleLocalDate(env.DIGEST_TIMEZONE) });
  revalidatePath("/digest");
  revalidatePath("/logs");
}

export async function generateYesterdayDigest() {
  await enqueueDailyDigest({
    digestDate: previousDateKey(getScheduleLocalDate(env.DIGEST_TIMEZONE)),
  });
  revalidatePath("/digest");
  revalidatePath("/logs");
}

export async function refreshDigestCandidates() {
  const digestDate = getScheduleLocalDate(env.DIGEST_TIMEZONE);
  await enqueueDailyDigestPreparation({ digestDate });
  revalidatePath("/digest");
  revalidatePath("/logs");
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
