import { registerFeedJobs } from "@/lib/jobs/feed-jobs";

const DISABLE_INLINE_WORKER = "RSXONHUB_DISABLE_INLINE_WORKER";

const globalForJobRuntime = globalThis as unknown as {
  rsxonhubInlineJobRuntime?: Promise<void>;
};

export function startInlineJobRuntime() {
  if (process.env[DISABLE_INLINE_WORKER] === "1") {
    return Promise.resolve();
  }

  globalForJobRuntime.rsxonhubInlineJobRuntime ??= registerFeedJobs().then(() => {
    console.info("rsxonhub inline job runtime started");
  });

  return globalForJobRuntime.rsxonhubInlineJobRuntime;
}

export function resetInlineJobRuntimeForTests() {
  globalForJobRuntime.rsxonhubInlineJobRuntime = undefined;
}
