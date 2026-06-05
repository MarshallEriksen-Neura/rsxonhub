import { beforeAll, describe, expect, test } from "bun:test";
import { parseClockTime } from "@/lib/datetime";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/rsxonhub_test";
});

const config = {
  timeZone: "Asia/Shanghai",
  prepareAt: parseClockTime("07:30"),
  generateAt: parseClockTime("08:00"),
  triggerWindowMinutes: 10,
};

const readyState = {
  hasActiveProfile: true,
  hasPrepared: false,
  hasSuccessfulDigest: false,
};

describe("decideDailyDigestSchedule", () => {
  test("does not enqueue before prepare time", async () => {
    const { decideDailyDigestSchedule } = await import("@/lib/jobs/scheduler-core");
    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-04T23:29:00.000Z"),
        config,
        state: readyState,
      }),
    ).toEqual({
      action: "skip",
      digestDate: "2026-06-05",
      reason: "before_prepare_time",
    });
  });

  test("prepares once after prepare time", async () => {
    const { decideDailyDigestSchedule } = await import("@/lib/jobs/scheduler-core");
    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-04T23:35:00.000Z"),
        config,
        state: readyState,
      }),
    ).toEqual({ action: "prepare", digestDate: "2026-06-05" });

    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-04T23:35:00.000Z"),
        config,
        state: { ...readyState, hasPrepared: true },
      }),
    ).toEqual({
      action: "skip",
      digestDate: "2026-06-05",
      reason: "already_prepared",
    });
  });

  test("enqueues generation in the trigger window", async () => {
    const { decideDailyDigestSchedule } = await import("@/lib/jobs/scheduler-core");
    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-05T00:03:00.000Z"),
        config,
        state: { ...readyState, hasPrepared: true },
      }),
    ).toEqual({ action: "generate", digestDate: "2026-06-05", catchUp: false });
  });

  test("catches up after generation time when no digest exists", async () => {
    const { decideDailyDigestSchedule } = await import("@/lib/jobs/scheduler-core");
    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-05T02:00:00.000Z"),
        config,
        state: { ...readyState, hasPrepared: true },
      }),
    ).toEqual({ action: "generate", digestDate: "2026-06-05", catchUp: true });
  });

  test("skips when today's digest already exists", async () => {
    const { decideDailyDigestSchedule } = await import("@/lib/jobs/scheduler-core");
    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-05T02:00:00.000Z"),
        config,
        state: { ...readyState, hasSuccessfulDigest: true },
      }),
    ).toEqual({
      action: "skip",
      digestDate: "2026-06-05",
      reason: "already_generated",
    });
  });

  test("skips when profile is missing", async () => {
    const { decideDailyDigestSchedule } = await import("@/lib/jobs/scheduler-core");
    expect(
      decideDailyDigestSchedule({
        now: new Date("2026-06-05T02:00:00.000Z"),
        config,
        state: {
          hasActiveProfile: false,
          hasPrepared: false,
          hasSuccessfulDigest: false,
        },
      }),
    ).toEqual({
      action: "skip",
      digestDate: "2026-06-05",
      reason: "no_interest_profile",
    });
  });
});
