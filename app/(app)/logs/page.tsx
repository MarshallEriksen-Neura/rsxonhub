import { desc, eq, sql } from "drizzle-orm";
import { AlertTriangle, Clock, Database, Rss } from "lucide-react";
import { Badge } from "@/components/retroui/Badge";
import { Empty } from "@/components/retroui/Empty";
import { Table } from "@/components/retroui/Table";
import { db } from "@/lib/db";
import { appErrorLogs, digestItems, digestRuns, digests, feeds } from "@/lib/db/schema";
import { getScheduleLocalDate } from "@/lib/datetime";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

const RECENT_LOG_LIMIT = 100;

type ErrorLogRow = Awaited<ReturnType<typeof getErrorLogs>>[number];

export default async function LogsPage() {
  const [logs, stats, digestStatus] = await Promise.all([
    getErrorLogs(),
    getErrorLogStats(),
    getDigestRunSummary(),
  ]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-5 lg:px-7 lg:py-6">
        <section className="grid gap-3 sm:grid-cols-4">
          <StatTile
            icon={Database}
            label="总日志"
            value={stats.total}
            tone="neutral"
          />
          <StatTile
            icon={Clock}
            label="24 小时内"
            value={stats.lastDay}
            tone={stats.lastDay > 0 ? "warning" : "neutral"}
          />
          <StatTile
            icon={Rss}
            label="订阅源错误"
            value={stats.rss}
            tone={stats.rss > 0 ? "danger" : "neutral"}
          />
          <StatTile
            icon={Clock}
            label="今日精选运行"
            value={digestStatus.latestRun ? 1 : 0}
            tone={
              digestStatus.latestRun?.status === "failed"
                ? "danger"
                : digestStatus.latestRun?.status === "skipped"
                  ? "warning"
                  : "neutral"
            }
          />
        </section>

        <section className="flex flex-col gap-3 border border-hairline bg-surface-soft p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-body-md-medium text-ink">每日精选运行状态</h2>
              <p className="text-body-sm text-steel">
                {digestStatus.digestDate} · 下次触发 {env.DIGEST_GENERATE_AT} {env.DIGEST_TIMEZONE}
              </p>
            </div>
            <Badge variant="outline" size="sm">
              {digestStatus.latestRun
                ? `${digestStatus.latestRun.phase} / ${digestStatus.latestRun.status}`
                : "暂无运行"}
            </Badge>
          </div>
          <div className="grid gap-3 text-body-sm text-charcoal sm:grid-cols-4">
            <StatusCell
              label="最近完成"
              value={
                digestStatus.latestRun?.finishedAt
                  ? digestStatus.latestRun.finishedAt.toLocaleString("zh-CN")
                  : "暂无"
              }
            />
            <StatusCell label="入选文章" value={digestStatus.selectedCount} />
            <StatusCell label="模型" value={digestStatus.digest?.model ?? "暂无"} />
            <StatusCell label="Tokens" value={digestStatus.digest?.tokenCost ?? 0} />
          </div>
          {digestStatus.latestRun?.error ? (
            <p className="break-words border-l-2 border-destructive/50 bg-destructive/5 px-3 py-2 text-body-sm text-destructive">
              {digestStatus.latestRun.error}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3 border-b border-hairline pb-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-heading-4 font-semibold text-ink">错误日志</h1>
              <p className="text-body-sm text-steel">
                最近 {RECENT_LOG_LIMIT} 条服务端错误。前端只展示通用提示,完整上游响应保存在这里。
              </p>
            </div>
            <Badge variant="default" size="sm" className="shrink-0">
              {logs.length} 条
            </Badge>
          </div>

          {logs.length === 0 ? (
            <Empty className="gap-4 border border-dashed border-hairline bg-surface-soft py-12 shadow-none hover:shadow-none">
              <Empty.Icon className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/8 text-primary">
                <AlertTriangle size={20} aria-hidden />
              </Empty.Icon>
              <div className="flex flex-col gap-1">
                <Empty.Title className="text-body-md-medium">暂无错误日志</Empty.Title>
                <Empty.Description className="text-body-sm text-steel">
                  抓取或 API 失败后会自动记录到这里。
                </Empty.Description>
              </div>
            </Empty>
          ) : (
            <Table className="border-hairline bg-card shadow-none">
              <Table.Header>
                <Table.Row>
                  <Table.Head className="w-32">时间</Table.Head>
                  <Table.Head>错误</Table.Head>
                  <Table.Head className="w-28 text-right">来源</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {logs.map((log) => (
                  <ErrorLogItem key={log.id} log={log} />
                ))}
              </Table.Body>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}

async function getErrorLogs() {
  return db
    .select({
      id: appErrorLogs.id,
      source: appErrorLogs.source,
      operation: appErrorLogs.operation,
      severity: appErrorLogs.severity,
      message: appErrorLogs.message,
      errorName: appErrorLogs.errorName,
      details: appErrorLogs.details,
      feedId: appErrorLogs.feedId,
      feedTitle: feeds.title,
      feedUrl: feeds.url,
      createdAt: appErrorLogs.createdAt,
    })
    .from(appErrorLogs)
    .leftJoin(feeds, eq(feeds.id, appErrorLogs.feedId))
    .orderBy(desc(appErrorLogs.createdAt))
    .limit(RECENT_LOG_LIMIT);
}

async function getErrorLogStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      lastDay: sql<number>`count(*) filter (where ${appErrorLogs.createdAt} > now() - interval '1 day')::int`,
      rss: sql<number>`count(*) filter (where ${appErrorLogs.source} = 'rss')::int`,
    })
    .from(appErrorLogs);

  return {
    total: row?.total ?? 0,
    lastDay: row?.lastDay ?? 0,
    rss: row?.rss ?? 0,
  };
}

async function getDigestRunSummary() {
  const digestDate = getScheduleLocalDate(env.DIGEST_TIMEZONE);
  const [latestRun, digest] = await Promise.all([
    db
      .select()
      .from(digestRuns)
      .where(eq(digestRuns.digestDate, digestDate))
      .orderBy(desc(digestRuns.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: digests.id,
        model: digests.model,
        tokenCost: digests.tokenCost,
        selectedCount: sql<number>`count(${digestItems.id})::int`,
      })
      .from(digests)
      .leftJoin(digestItems, eq(digestItems.digestId, digests.id))
      .where(eq(digests.digestDate, digestDate))
      .groupBy(digests.id)
      .orderBy(desc(digests.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return {
    digestDate,
    latestRun,
    digest,
    selectedCount: digest?.selectedCount ?? 0,
  };
}

function ErrorLogItem({ log }: { log: ErrorLogRow }) {
  const upstream = upstreamSummary(log.details);
  const details = JSON.stringify(log.details ?? {}, null, 2);

  return (
    <Table.Row>
      <Table.Cell className="w-32 align-top">
      <time
        dateTime={log.createdAt.toISOString()}
        className="text-micro text-steel"
      >
        {formatDate(log.createdAt)}
      </time>
      </Table.Cell>

      <Table.Cell className="min-w-[32rem] align-top">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={log.severity === "error" ? "solid" : "default"}
            size="sm"
            className={cn(log.severity === "error" && "bg-destructive text-white")}
          >
            {log.severity}
          </Badge>
          {log.errorName ? (
            <span className="text-micro font-medium text-steel">{log.errorName}</span>
          ) : null}
          <span className="text-micro text-stone">{log.operation}</span>
        </div>

        <p className="break-words text-body-sm text-ink">{log.message}</p>

        {upstream ? (
          <div className="flex flex-col gap-1 border-l-2 border-destructive/40 bg-destructive/5 px-3 py-2 text-micro text-charcoal">
            <span className="font-semibold text-destructive">
              Upstream {upstream.statusCode ?? "unknown"}
            </span>
            {upstream.url ? <span className="break-all">{upstream.url}</span> : null}
            {upstream.contentType ? <span>{upstream.contentType}</span> : null}
          </div>
        ) : null}

        {log.feedTitle || log.feedUrl ? (
          <p className="truncate text-micro text-steel">
            订阅源: {log.feedTitle ?? log.feedUrl}
          </p>
        ) : null}

        {details !== "{}" ? (
          <details className="group">
            <summary className="cursor-pointer text-micro font-medium text-primary hover:underline">
              查看 details JSON
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto border border-hairline bg-surface-soft p-3 text-micro leading-relaxed text-charcoal">
              {details}
            </pre>
          </details>
        ) : null}
      </div>
      </Table.Cell>

      <Table.Cell className="w-28 align-top">
      <div className="flex justify-end">
        <Badge variant="outline" size="sm" className="h-fit">
          {log.source}
        </Badge>
      </div>
      </Table.Cell>
    </Table.Row>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Database;
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border border-hairline bg-card px-4 py-3",
        tone === "warning" && "border-amber-300/60 bg-amber-50",
        tone === "danger" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex flex-col">
        <span className="text-micro font-medium text-steel">{label}</span>
        <span className="text-heading-4 font-semibold text-ink">{value}</span>
      </div>
      <Icon
        size={20}
        aria-hidden
        className={cn(
          "text-stone",
          tone === "warning" && "text-amber-600",
          tone === "danger" && "text-destructive",
        )}
      />
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-micro font-medium text-steel">{label}</span>
      <span className="break-words text-body-sm-medium text-ink">{value}</span>
    </div>
  );
}

function upstreamSummary(details: Record<string, unknown> | null) {
  const upstream = details?.upstream;
  if (!upstream || typeof upstream !== "object") return null;
  return upstream as {
    statusCode?: number;
    url?: string;
    contentType?: string;
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
