"use server";

import { revalidatePath } from "next/cache";
import { generateDailyDigest } from "@/lib/digest/generate-digest";
import { getScheduleLocalDate } from "@/lib/datetime";
import { env } from "@/lib/env";
import { runDigestPreparation } from "@/lib/jobs/feed-jobs";

export async function regenerateTodayDigest() {
  await generateDailyDigest({ digestDate: getScheduleLocalDate(env.DIGEST_TIMEZONE) });
  revalidatePath("/digest");
  revalidatePath("/logs");
}

export async function generateYesterdayDigest() {
  await generateDailyDigest({
    digestDate: previousDateKey(getScheduleLocalDate(env.DIGEST_TIMEZONE)),
  });
  revalidatePath("/digest");
  revalidatePath("/logs");
}

export async function refreshDigestCandidates() {
  const digestDate = getScheduleLocalDate(env.DIGEST_TIMEZONE);
  await runDigestPreparation({ digestDate });
  revalidatePath("/digest");
  revalidatePath("/logs");
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
