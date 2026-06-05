import {
  getScheduleLocalDate,
  parseClockTime,
} from "@/lib/datetime";
import { env } from "@/lib/env";
import {
  createDigestRun,
  hasCompletedDigestRun,
  hasSuccessfulDigest,
} from "@/lib/digest/runs";
import { getActiveInterestProfile } from "@/lib/interests/profile";
import {
  enqueueDailyDigest,
  enqueueDailyDigestPreparation,
} from "@/lib/jobs/feed-jobs";
import {
  decideDailyDigestSchedule,
  type DigestScheduleConfig,
} from "@/lib/jobs/scheduler-core";

export { decideDailyDigestSchedule };

export function getDigestScheduleConfig(): DigestScheduleConfig {
  return {
    timeZone: env.DIGEST_TIMEZONE,
    prepareAt: parseClockTime(env.DIGEST_PREPARE_AT),
    generateAt: parseClockTime(env.DIGEST_GENERATE_AT),
    triggerWindowMinutes: env.DIGEST_TRIGGER_WINDOW_MINUTES,
  };
}

export async function enqueueDueDailyDigest(now = new Date()) {
  const config = getDigestScheduleConfig();
  const digestDate = getScheduleLocalDate(config.timeZone, now);
  const profile = await getActiveInterestProfile();

  if (!profile) {
    const decision = decideDailyDigestSchedule({
      now,
      config,
      state: {
        hasActiveProfile: false,
        hasPrepared: false,
        hasSuccessfulDigest: false,
      },
    });
    if (decision.action === "skip" && decision.reason === "no_interest_profile") {
      const alreadySkipped = await hasCompletedDigestRun({
        digestDate,
        interestProfileVersion: 0,
        phase: "generate",
        statuses: ["skipped"],
      });
      if (!alreadySkipped) {
        await createDigestRun({
          digestDate,
          interestProfileVersion: 0,
          phase: "generate",
          status: "skipped",
          error: "no_interest_profile",
        });
      }
    }
    return decision;
  }

  const [generated, prepared, inFlight] = await Promise.all([
    hasSuccessfulDigest({
      digestDate,
      interestProfileVersion: profile.version,
    }),
    hasCompletedDigestRun({
      digestDate,
      interestProfileVersion: profile.version,
      phase: "prepare",
      statuses: ["success", "skipped"],
    }),
    hasCompletedDigestRun({
      digestDate,
      interestProfileVersion: profile.version,
      phase: "generate",
      statuses: ["pending", "running"],
    }),
  ]);

  const decision = decideDailyDigestSchedule({
    now,
    config,
    state: {
      hasActiveProfile: true,
      hasPrepared: prepared,
      hasSuccessfulDigest: generated,
      hasInFlightGeneration: inFlight,
    },
  });

  if (decision.action === "prepare") {
    await enqueueDailyDigestPreparation({
      digestDate: decision.digestDate,
      interestProfileVersion: profile.version,
    });
  }

  if (decision.action === "generate") {
    await enqueueDailyDigest({
      digestDate: decision.digestDate,
      interestProfileVersion: profile.version,
    });
  }

  return decision;
}
