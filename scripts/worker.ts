import { registerFeedJobs, enqueueDueFeedScan } from "@/lib/jobs/feed-jobs";
import { startBoss, stopBoss } from "@/lib/jobs/boss";

async function main() {
  await startBoss();
  await registerFeedJobs();
  await enqueueDueFeedScan();

  console.log("rsxonhub worker started");
}

async function shutdown(signal: string) {
  console.log(`rsxonhub worker stopping after ${signal}`);
  await stopBoss();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
