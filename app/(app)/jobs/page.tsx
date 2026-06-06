import { QueueStatusWorkspace } from "@/components/jobs/queue-status-workspace";
import { getQueueSnapshots } from "@/lib/jobs/queue-monitor";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  return (
    <QueueStatusWorkspace
      initialQueues={await getQueueSnapshots()}
      initialUpdatedAt={new Date().toISOString()}
    />
  );
}
