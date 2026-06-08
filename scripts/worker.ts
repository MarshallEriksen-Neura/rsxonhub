import {
  enqueueDueFeedScan,
  registerFeedJobs,
} from "@/lib/jobs/feed-jobs";
import { startBoss, stopBoss } from "@/lib/jobs/boss";
import { env } from "@/lib/env";
import { enqueueDueDailyDigest } from "@/lib/jobs/scheduler";

const FEED_SCAN_INTERVAL_MS = Number(process.env.FEED_SCAN_INTERVAL_MS ?? 5 * 60 * 1000);
const DIGEST_SCAN_INTERVAL_MS = env.DIGEST_SCAN_INTERVAL_MS;

let intervals: NodeJS.Timeout[] = [];

async function main() {
  await startBoss();
  await registerFeedJobs();
  await tick();

  intervals = [
    setInterval(() => void enqueueDueFeedScan(), FEED_SCAN_INTERVAL_MS),
    setInterval(() => void enqueueDueDailyDigest(), DIGEST_SCAN_INTERVAL_MS),
  ];

  console.log("rsxonhub worker started");
}

async function tick() {
  await Promise.all([enqueueDueFeedScan(), enqueueDueDailyDigest()]);
}

async function shutdown(signal: string) {
  console.log(`rsxonhub worker stopping after ${signal}`);
  for (const interval of intervals) clearInterval(interval);
  intervals = [];
  await stopBoss();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
