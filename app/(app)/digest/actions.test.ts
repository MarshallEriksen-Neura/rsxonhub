import { afterEach, describe, expect, mock, test } from "bun:test";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/rsxonhub_test";
process.env.DIGEST_TIMEZONE = "Asia/Shanghai";

const generateDailyDigestMock = mock(async () => ({ skipped: false as const }));
const runDigestPreparationMock = mock(async () => ({
  skipped: false as const,
  reason: null,
  candidateCount: 1,
  analyzedCount: 1,
}));
const enqueueDailyDigestMock = mock(async () => "job-id");
const enqueueDailyDigestPreparationMock = mock(async () => "job-id");
const revalidatePathMock = mock(() => undefined);

mock.module("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

mock.module("@/lib/digest/generate-digest", () => ({
  generateDailyDigest: generateDailyDigestMock,
}));

mock.module("@/lib/datetime", () => ({
  getScheduleLocalDate: mock(() => "2026-06-06"),
  parseClockTime: (value: string) => {
    const [hours = "0", minutes = "0"] = value.split(":");
    return { hours: Number(hours), minutes: Number(minutes) };
  },
}));

mock.module("@/lib/jobs/feed-jobs", () => ({
  enqueueDailyDigest: enqueueDailyDigestMock,
  enqueueDailyDigestPreparation: enqueueDailyDigestPreparationMock,
  runDigestPreparation: runDigestPreparationMock,
}));

describe("digest page manual actions", () => {
  afterEach(() => {
    generateDailyDigestMock.mockClear();
    runDigestPreparationMock.mockClear();
    enqueueDailyDigestMock.mockClear();
    enqueueDailyDigestPreparationMock.mockClear();
    revalidatePathMock.mockClear();
  });

  test("regenerates today's digest immediately instead of enqueueing it", async () => {
    const { regenerateTodayDigest } = await import("./actions");

    await regenerateTodayDigest();

    expect(generateDailyDigestMock).toHaveBeenCalledWith({ digestDate: "2026-06-06" });
    expect(enqueueDailyDigestMock).not.toHaveBeenCalled();
    expect(revalidatePathMock.mock.calls.map((call) => call[0])).toEqual([
      "/digest",
      "/logs",
    ]);
  });

  test("generates yesterday's digest immediately instead of enqueueing it", async () => {
    const { generateYesterdayDigest } = await import("./actions");

    await generateYesterdayDigest();

    expect(generateDailyDigestMock).toHaveBeenCalledWith({ digestDate: "2026-06-05" });
    expect(enqueueDailyDigestMock).not.toHaveBeenCalled();
  });

  test("refreshes digest candidates immediately instead of enqueueing preparation", async () => {
    const { refreshDigestCandidates } = await import("./actions");

    await refreshDigestCandidates();

    expect(runDigestPreparationMock).toHaveBeenCalledWith({ digestDate: "2026-06-06" });
    expect(enqueueDailyDigestPreparationMock).not.toHaveBeenCalled();
  });
});
