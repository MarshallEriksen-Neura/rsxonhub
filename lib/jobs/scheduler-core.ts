import {
  clockTimeToMinutes,
  getScheduleLocalDate,
  getScheduleLocalMinutes,
  type ClockTime,
} from "@/lib/datetime";

export type DigestScheduleConfig = {
  timeZone: string;
  prepareAt: ClockTime;
  generateAt: ClockTime;
  triggerWindowMinutes: number;
};

export type DigestScheduleState = {
  hasActiveProfile: boolean;
  hasPrepared: boolean;
  hasSuccessfulDigest: boolean;
  hasInFlightGeneration?: boolean;
};

export type DigestScheduleDecision =
  | { action: "prepare"; digestDate: string }
  | { action: "generate"; digestDate: string; catchUp: boolean }
  | {
      action: "skip";
      digestDate: string;
      reason:
        | "before_prepare_time"
        | "no_interest_profile"
        | "already_generated"
        | "generation_in_flight"
        | "already_prepared";
    };

export function decideDailyDigestSchedule(input: {
  now: Date;
  config: DigestScheduleConfig;
  state: DigestScheduleState;
}): DigestScheduleDecision {
  const digestDate = getScheduleLocalDate(input.config.timeZone, input.now);
  const localMinutes = getScheduleLocalMinutes(input.config.timeZone, input.now);
  const prepareMinutes = clockTimeToMinutes(input.config.prepareAt);
  const generateMinutes = clockTimeToMinutes(input.config.generateAt);
  const generateWindowEnd = generateMinutes + input.config.triggerWindowMinutes;

  if (!input.state.hasActiveProfile) {
    return { action: "skip", digestDate, reason: "no_interest_profile" };
  }

  if (input.state.hasSuccessfulDigest) {
    return { action: "skip", digestDate, reason: "already_generated" };
  }

  if (input.state.hasInFlightGeneration) {
    return { action: "skip", digestDate, reason: "generation_in_flight" };
  }

  if (localMinutes >= generateMinutes && localMinutes < generateWindowEnd) {
    return { action: "generate", digestDate, catchUp: false };
  }

  if (localMinutes >= generateMinutes) {
    return { action: "generate", digestDate, catchUp: true };
  }

  if (localMinutes < prepareMinutes) {
    return { action: "skip", digestDate, reason: "before_prepare_time" };
  }

  if (input.state.hasPrepared) {
    return { action: "skip", digestDate, reason: "already_prepared" };
  }

  return { action: "prepare", digestDate };
}
