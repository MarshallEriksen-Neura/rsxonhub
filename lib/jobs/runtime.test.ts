import { afterEach, describe, expect, mock, test } from "bun:test";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/rsxonhub_test";

const registerFeedJobsMock = mock(async () => undefined);

mock.module("@/lib/jobs/feed-jobs", () => ({
  registerFeedJobs: registerFeedJobsMock,
}));

describe("inline job runtime", () => {
  afterEach(async () => {
    delete process.env.RSXONHUB_DISABLE_INLINE_WORKER;
    registerFeedJobsMock.mockReset();
    registerFeedJobsMock.mockImplementation(async () => undefined);

    const { resetInlineJobRuntimeForTests } = await import("@/lib/jobs/runtime");
    resetInlineJobRuntimeForTests();
  });

  test("registers feed jobs once per server instance", async () => {
    const { startInlineJobRuntime } = await import("@/lib/jobs/runtime");

    await Promise.all([startInlineJobRuntime(), startInlineJobRuntime()]);

    expect(registerFeedJobsMock).toHaveBeenCalledTimes(1);
  });

  test("can be disabled for deployments that run a separate worker", async () => {
    process.env.RSXONHUB_DISABLE_INLINE_WORKER = "1";
    const { startInlineJobRuntime } = await import("@/lib/jobs/runtime");

    await startInlineJobRuntime();

    expect(registerFeedJobsMock).not.toHaveBeenCalled();
  });
});
