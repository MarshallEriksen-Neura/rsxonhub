import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { startBoss } from "@/lib/jobs/boss";
import { JOB_NAMES } from "@/lib/jobs/names";
import { queueStateInSql } from "@/lib/jobs/queue-sql";
import {
  isKnownQueue,
  type QueueAction,
  type QueueSnapshot,
} from "@/lib/jobs/queue-types";

type QueueSnapshotRow = {
  name: string;
  created: number | string | null;
  retry: number | string | null;
  active: number | string | null;
  completed: number | string | null;
  failed: number | string | null;
  cancelled: number | string | null;
  expired: number | string | null;
  total: number | string | null;
  oldestWaitingAt: Date | string | null;
  newestJobAt: Date | string | null;
  lastCompletedAt: Date | string | null;
};

type JobIdRow = {
  id: string;
};

type CountRow = {
  count: number | string | null;
};

export async function getQueueSnapshots(): Promise<QueueSnapshot[]> {
  const rows = await db.execute<QueueSnapshotRow>(sql`
    with known(name) as (
      values
        (${JOB_NAMES.feedFetchDue}),
        (${JOB_NAMES.feedFetchOne}),
        (${JOB_NAMES.articleEmbed}),
        (${JOB_NAMES.digestPrepareDaily}),
        (${JOB_NAMES.digestGenerateDaily})
    )
    select
      known.name,
      count(job.id) filter (where job.state::text = 'created')::int as created,
      count(job.id) filter (where job.state::text = 'retry')::int as retry,
      count(job.id) filter (where job.state::text = 'active')::int as active,
      count(job.id) filter (where job.state::text = 'completed')::int as completed,
      count(job.id) filter (where job.state::text = 'failed')::int as failed,
      count(job.id) filter (where job.state::text = 'cancelled')::int as cancelled,
      count(job.id) filter (where job.state::text = 'expired')::int as expired,
      count(job.id)::int as total,
      min(job.created_on) filter (where job.state::text in ('created', 'retry')) as "oldestWaitingAt",
      max(job.created_on) as "newestJobAt",
      max(job.completed_on) filter (where job.state::text = 'completed') as "lastCompletedAt"
    from known
    left join pgboss.job job on job.name = known.name
    group by known.name
    order by
      count(job.id) filter (where job.state::text in ('created', 'retry')) desc,
      known.name asc
  `);

  return rows.map((row) => {
    const created = numberValue(row.created);
    const retry = numberValue(row.retry);

    return {
      name: row.name,
      created,
      retry,
      active: numberValue(row.active),
      completed: numberValue(row.completed),
      failed: numberValue(row.failed),
      cancelled: numberValue(row.cancelled),
      expired: numberValue(row.expired),
      total: numberValue(row.total),
      waiting: created + retry,
      oldestWaitingAt: isoValue(row.oldestWaitingAt),
      newestJobAt: isoValue(row.newestJobAt),
      lastCompletedAt: isoValue(row.lastCompletedAt),
    };
  });
}

export async function runQueueAction(queueName: string, action: QueueAction) {
  if (!isKnownQueue(queueName)) {
    throw new Error("UNKNOWN_QUEUE");
  }

  if (action === "cancel-waiting") {
    const before = await countJobs(queueName, ["created", "retry"]);
    if (before > 0) {
      const boss = await startBoss();
      await boss.deleteQueuedJobs(queueName);
    }
    return { affected: before };
  }

  if (action === "retry-failed") {
    const failedIds = await getFailedJobIds(queueName);
    if (failedIds.length > 0) {
      const boss = await startBoss();
      await boss.retry(queueName, failedIds);
    }
    return { affected: failedIds.length };
  }

  if (action === "delete-completed") {
    const deleted = await db.execute<CountRow>(sql`
      delete from pgboss.job
      where name = ${queueName}
        and state::text = 'completed'
      returning 1
    `);
    return { affected: deleted.length };
  }

  throw new Error("UNKNOWN_ACTION");
}

async function getFailedJobIds(queueName: string) {
  const rows = await db.execute<JobIdRow>(sql`
    select id::text as id
    from pgboss.job
    where name = ${queueName}
      and state::text = 'failed'
    order by created_on asc
    limit 500
  `);

  return rows.map((row) => row.id);
}

async function countJobs(queueName: string, states: string[]) {
  const rows = await db.execute<CountRow>(sql`
    select count(*)::int as count
    from pgboss.job
    where name = ${queueName}
      and ${queueStateInSql(states)}
  `);

  return numberValue(rows[0]?.count ?? 0);
}

function numberValue(value: number | string | null) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function isoValue(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}
