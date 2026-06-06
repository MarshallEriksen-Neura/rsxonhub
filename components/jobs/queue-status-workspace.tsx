"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DatabaseZap,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/retroui/Button";
import { Dialog } from "@/components/retroui/Dialog";
import { Empty } from "@/components/retroui/Empty";
import { Table } from "@/components/retroui/Table";
import {
  ConsoleHeader,
  ConsolePanel,
  CountChip,
  MetricCard,
} from "@/components/console/console-kit";
import {
  QUEUE_LABELS,
  type QueueAction,
  type QueueSnapshot,
} from "@/lib/jobs/queue-types";
import { JOB_NAMES } from "@/lib/jobs/names";
import { cn } from "@/lib/utils";

type QueueSnapshotResponse = {
  queues: QueueSnapshot[];
  updatedAt: string;
};

type QueueActionResponse = QueueSnapshotResponse & {
  ok: boolean;
  affected: number;
  message?: string;
};

type QueueStatusWorkspaceProps = {
  initialQueues: QueueSnapshot[];
  initialUpdatedAt: string;
};

type ConfirmAction = {
  queue: QueueSnapshot;
  action: QueueAction;
} | null;

const ACTION_LABELS: Record<QueueAction, string> = {
  "cancel-waiting": "取消等待",
  "retry-failed": "重试失败",
  "delete-completed": "清理完成",
};

export function QueueStatusWorkspace({
  initialQueues,
  initialUpdatedAt,
}: QueueStatusWorkspaceProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [queues, setQueues] = useState(initialQueues);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "closed">(
    "connecting",
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const totals = useMemo(
    () =>
      queues.reduce(
        (acc, queue) => ({
          waiting: acc.waiting + queue.waiting,
          active: acc.active + queue.active,
          failed: acc.failed + queue.failed,
          completed: acc.completed + queue.completed,
        }),
        { waiting: 0, active: 0, failed: 0, completed: 0 },
      ),
    [queues],
  );
  const busiest = useMemo(
    () =>
      queues.reduce<QueueSnapshot | null>(
        (hit, queue) => (!hit || queue.waiting > hit.waiting ? queue : hit),
        null,
      ),
    [queues],
  );

  useEffect(() => {
    const source = new EventSource("/api/jobs/events");
    eventSourceRef.current = source;

    source.addEventListener("snapshot", (event) => {
      const payload = JSON.parse(event.data) as QueueSnapshotResponse;
      setQueues(payload.queues);
      setUpdatedAt(payload.updatedAt);
      setConnectionState("live");
    });

    source.addEventListener("heartbeat", () => {
      setConnectionState("live");
    });

    source.onerror = () => {
      setConnectionState("closed");
      source.close();
      eventSourceRef.current = null;
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, []);

  const refresh = async () => {
    const response = await fetch("/api/jobs/snapshot", { cache: "no-store" });
    const payload = (await response.json()) as QueueSnapshotResponse;
    if (!response.ok) {
      toast.error("队列状态刷新失败。");
      return;
    }
    setQueues(payload.queues);
    setUpdatedAt(payload.updatedAt);
  };

  const requestAction = (queue: QueueSnapshot, action: QueueAction) => {
    setConfirmAction({ queue, action });
  };

  const runAction = async (queue: QueueSnapshot, action: QueueAction) => {
    const actionKey = `${queue.name}:${action}`;
    setPendingAction(actionKey);
    try {
      const response = await fetch("/api/jobs/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueName: queue.name, action }),
      });
      const payload = (await response.json()) as QueueActionResponse;
      if (!response.ok || !payload.ok) {
        toast.error(payload.message ?? "队列操作失败。");
        return;
      }
      setQueues(payload.queues);
      setUpdatedAt(payload.updatedAt);
      toast.success(`${ACTION_LABELS[action]}: ${payload.affected} 个任务`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "队列操作失败。");
    } finally {
      setPendingAction(null);
    }
  };

  const confirmAndRunAction = async () => {
    if (!confirmAction) return;
    const { queue, action } = confirmAction;
    setConfirmAction(null);
    await runAction(queue, action);
  };

  const confirmMessage = confirmAction
    ? actionConfirmMessage(confirmAction.queue, confirmAction.action)
    : null;

  const isLive = connectionState === "live";

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 lg:px-8 lg:py-6">
        <ConsoleHeader
          kicker="RUNTIME · pg-boss"
          title="队列状态"
          subtitle={
            <>
              实时聚合快照。待处理 = created + retry。最近更新{" "}
              <span className="font-mono text-charcoal">{formatDateTime(updatedAt)}</span>。
            </>
          }
          status={{
            tone: isLive ? "live" : "warning",
            label: isLive ? "实时" : "手动刷新",
            pulse: isLive,
          }}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw size={14} aria-hidden />
              刷新
            </Button>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Clock}
            label="待处理"
            value={totals.waiting.toLocaleString("zh-CN")}
            tone={totals.waiting > 1000 ? "warning" : "neutral"}
            delay={0}
          />
          <MetricCard
            icon={Activity}
            label="执行中"
            value={totals.active.toLocaleString("zh-CN")}
            tone={totals.active > 0 ? "info" : "neutral"}
            delay={60}
          />
          <MetricCard
            icon={AlertTriangle}
            label="失败"
            value={totals.failed.toLocaleString("zh-CN")}
            tone={totals.failed > 0 ? "danger" : "live"}
            delay={120}
          />
          <MetricCard
            icon={CheckCircle2}
            label="已完成"
            value={totals.completed.toLocaleString("zh-CN")}
            tone="neutral"
            delay={180}
          />
        </section>

        <ConsolePanel
          label="队列明细"
          badge={<CountChip>{queues.length}</CountChip>}
          action={
            <div className="flex items-center gap-x-4 gap-y-1 font-mono text-micro text-stone">
              <span>
                <span className="text-steel">最忙 · </span>
                {busiest ? queueTitle(busiest.name) : "暂无"}
              </span>
              <span className="hidden sm:inline">
                <span className="text-steel">最早等待 · </span>
                {formatDateTime(findOldestWaiting(queues))}
              </span>
            </div>
          }
          bodyClassName="p-0"
        >
          {queues.every((queue) => queue.total === 0) ? (
            <div className="p-4">
              <Empty className="gap-4 border border-dashed border-hairline bg-surface-soft py-12 shadow-none hover:shadow-none">
                <Empty.Icon className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/8 text-primary">
                  <ListChecks size={20} aria-hidden />
                </Empty.Icon>
                <div className="flex flex-col gap-1">
                  <Empty.Title className="text-body-md-medium">暂无队列任务</Empty.Title>
                  <Empty.Description className="text-body-sm text-steel">
                    后台抓取、摘要或向量索引入队后会显示在这里。
                  </Empty.Description>
                </div>
              </Empty>
            </div>
          ) : (
            <Table className="border-0 bg-transparent shadow-none">
              <Table.Header>
                <Table.Row>
                  <Table.Head>队列</Table.Head>
                  <Table.Head className="text-right">待处理</Table.Head>
                  <Table.Head className="text-right">执行中</Table.Head>
                  <Table.Head className="text-right">失败</Table.Head>
                  <Table.Head className="text-right">已完成</Table.Head>
                  <Table.Head className="hidden text-right lg:table-cell">分布</Table.Head>
                  <Table.Head className="text-right">最早等待</Table.Head>
                  <Table.Head className="text-right">操作</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {queues.map((queue) => (
                  <QueueRow
                    key={queue.name}
                    queue={queue}
                    pendingAction={pendingAction}
                    onAction={requestAction}
                  />
                ))}
              </Table.Body>
            </Table>
          )}
        </ConsolePanel>
      </div>
      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <Dialog.Content size="sm" className="font-sans">
          <Dialog.Header>
            <h2 className="text-body-md-medium">确认队列操作</h2>
          </Dialog.Header>
          <Dialog.Description className="px-4 py-5 text-body-sm text-charcoal">
            {confirmMessage}
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(pendingAction)}
              onClick={() => void confirmAndRunAction()}
              className={cn(confirmAction?.action === "delete-completed" && "text-destructive")}
            >
              确认执行
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </main>
  );
}

function QueueRow({
  queue,
  pendingAction,
  onAction,
}: {
  queue: QueueSnapshot;
  pendingAction: string | null;
  onAction: (queue: QueueSnapshot, action: QueueAction) => void;
}) {
  return (
    <Table.Row>
      <Table.Cell className="min-w-64">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/15">
            <QueueIcon queue={queue.name} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-body-sm-medium text-ink">
              {queueTitle(queue.name)}
            </div>
            <div className="mt-0.5 truncate font-mono text-micro text-stone">{queue.name}</div>
          </div>
        </div>
      </Table.Cell>
      <QueueMetric value={queue.waiting} tone={queue.waiting > 1000 ? "warning" : "neutral"} />
      <QueueMetric value={queue.active} tone={queue.active > 0 ? "info" : "neutral"} />
      <QueueMetric value={queue.failed} tone={queue.failed > 0 ? "danger" : "neutral"} />
      <QueueMetric value={queue.completed} tone="neutral" />
      <Table.Cell className="hidden min-w-32 lg:table-cell">
        <DistributionBar queue={queue} />
      </Table.Cell>
      <Table.Cell className="text-right">
        <div className="font-mono text-micro text-charcoal">
          {formatDateTime(queue.oldestWaitingAt)}
        </div>
        {queue.retry > 0 ? (
          <div className="mt-0.5 font-mono text-micro text-brand-orange-deep dark:text-brand-orange">
            retry {queue.retry}
          </div>
        ) : null}
      </Table.Cell>
      <Table.Cell className="min-w-64">
        <div className="flex justify-end gap-1.5">
          <QueueActionButton
            queue={queue}
            action="retry-failed"
            disabled={queue.failed === 0}
            pendingAction={pendingAction}
            onAction={onAction}
          />
          <QueueActionButton
            queue={queue}
            action="cancel-waiting"
            disabled={queue.waiting === 0}
            pendingAction={pendingAction}
            onAction={onAction}
          />
          <QueueActionButton
            queue={queue}
            action="delete-completed"
            disabled={queue.completed === 0}
            pendingAction={pendingAction}
            onAction={onAction}
          />
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

/** Horizontal stacked bar — the queue's job composition at a glance. */
function DistributionBar({ queue }: { queue: QueueSnapshot }) {
  const segments = [
    { value: queue.waiting, className: "bg-stone" },
    { value: queue.active, className: "bg-primary" },
    { value: queue.failed, className: "bg-destructive" },
    { value: queue.completed, className: "bg-semantic-success" },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div className="h-1.5 w-full rounded-full bg-hairline" />;
  }
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline">
      {segments.map((s, i) =>
        s.value > 0 ? (
          <span
            key={i}
            className={cn("h-full", s.className)}
            style={{ width: `${(s.value / total) * 100}%` }}
            aria-hidden
          />
        ) : null,
      )}
    </div>
  );
}

function QueueActionButton({
  queue,
  action,
  disabled,
  pendingAction,
  onAction,
}: {
  queue: QueueSnapshot;
  action: QueueAction;
  disabled: boolean;
  pendingAction: string | null;
  onAction: (queue: QueueSnapshot, action: QueueAction) => void;
}) {
  const isPending = pendingAction === `${queue.name}:${action}`;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || Boolean(pendingAction)}
      onClick={() => onAction(queue, action)}
      className={cn(action === "delete-completed" && "text-destructive")}
      title={ACTION_LABELS[action]}
    >
      {action === "retry-failed" ? <RotateCcw size={13} aria-hidden /> : null}
      {action === "cancel-waiting" ? <Trash2 size={13} aria-hidden /> : null}
      {action === "delete-completed" ? <Trash2 size={13} aria-hidden /> : null}
      {isPending ? "处理中" : ACTION_LABELS[action]}
    </Button>
  );
}

function QueueIcon({ queue }: { queue: string }) {
  if (queue === JOB_NAMES.articleEmbed) return <DatabaseZap size={16} aria-hidden />;
  if (queue === JOB_NAMES.feedFetchOne || queue === JOB_NAMES.feedFetchDue) {
    return <RotateCcw size={16} aria-hidden />;
  }
  return <Clock size={16} aria-hidden />;
}

function QueueMetric({
  value,
  tone,
}: {
  value: number;
  tone: "neutral" | "info" | "warning" | "danger";
}) {
  return (
    <Table.Cell className="text-right">
      <div
        className={cn(
          "font-mono text-body-sm-medium tabular-nums text-ink",
          tone === "info" && "text-primary",
          tone === "warning" && "text-brand-orange-deep dark:text-brand-orange",
          tone === "danger" && "text-destructive",
        )}
      >
        {value.toLocaleString("zh-CN")}
      </div>
    </Table.Cell>
  );
}

function actionConfirmMessage(queue: QueueSnapshot, action: QueueAction) {
  if (action === "cancel-waiting") {
    return `确认取消 ${queueTitle(queue.name)} 的 ${queue.waiting} 个等待任务?`;
  }
  if (action === "delete-completed") {
    return `确认清理 ${queueTitle(queue.name)} 的 ${queue.completed} 个已完成任务?`;
  }
  if (action === "retry-failed") {
    return `确认重试 ${queueTitle(queue.name)} 的 ${queue.failed} 个失败任务?`;
  }
  return null;
}

function queueTitle(name: string) {
  return QUEUE_LABELS[name] ?? name;
}

function findOldestWaiting(queues: QueueSnapshot[]) {
  return queues
    .map((queue) => queue.oldestWaitingAt)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
}

function formatDateTime(value: string | null) {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
