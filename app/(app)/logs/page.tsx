import { desc, eq, sql } from "drizzle-orm";
import { AlertTriangle, Clock, Database, Rss } from "lucide-react";
import { Badge } from "@/components/retroui/Badge";
import { Empty } from "@/components/retroui/Empty";
import {
  ConsoleHeader,
  ConsolePanel,
  CountChip,
  MetricCard,
  type ConsoleTone,
} from "@/components/console/console-kit";
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

  const digestTone: ConsoleTone =
    digestStatus.latestRun?.status === "failed"
      ? "danger"
      : digestStatus.latestRun?.status === "skipped"
        ? "warning"
        : digestStatus.latestRun
          ? "live"
          : "neutral";

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 lg:px-6 lg:py-6">
        <ConsoleHeader
          kicker="SYSTEM · 错误监控"
          title="错误日志"
          subtitle={`服务端抓取与 API 失败的完整上游记录。前端仅展示通用提示,详情留存于此。保留最近 ${RECENT_LOG_LIMIT} 条。`}
          status={{
            tone: stats.lastDay > 0 ? "warning" : "live",
            label: stats.lastDay > 0 ? `24H · ${stats.lastDay}` : "稳定",
            pulse: stats.lastDay > 0,
          }}
        />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Database}
            label="总日志"
            value={stats.total.toLocaleString("zh-CN")}
            tone="neutral"
            delay={0}
          />
          <MetricCard
            icon={Clock}
            label="24 小时内"
            value={stats.lastDay.toLocaleString("zh-CN")}
            tone={stats.lastDay > 0 ? "warning" : "live"}
            hint={stats.lastDay > 0 ? "近期有新增错误" : "近 24H 无新增"}
            delay={60}
          />
          <MetricCard
            icon={Rss}
            label="订阅源错误"
            value={stats.rss.toLocaleString("zh-CN")}
            tone={stats.rss > 0 ? "danger" : "live"}
            delay={120}
          />
          <MetricCard
            icon={Clock}
            label="今日精选运行"
            value={digestStatus.latestRun ? "1" : "0"}
            tone={digestTone}
            hint={digestStatus.latestRun?.status ?? "暂无运行"}
            delay={180}
          />
        </section>

        <ConsolePanel
          label="每日精选运行状态"
          badge={
            <Badge variant="outline" size="sm">
              {digestStatus.latestRun
                ? `${digestStatus.latestRun.phase} / ${digestStatus.latestRun.status}`
                : "暂无运行"}
            </Badge>
          }
          action={
            <span className="font-mono text-micro text-stone">
              {digestStatus.digestDate} · 下次 {env.DIGEST_GENERATE_AT} {env.DIGEST_TIMEZONE}
            </span>
          }
          bodyClassName="flex flex-col gap-3"
        >
          <div className="grid gap-px overflow-hidden border border-hairline bg-hairline sm:grid-cols-4">
            <StatusCell
              label="最近完成"
              value={
                digestStatus.latestRun?.finishedAt
                  ? digestStatus.latestRun.finishedAt.toLocaleString("zh-CN")
                  : "暂无"
              }
            />
            <StatusCell label="入选文章" value={digestStatus.selectedCount} mono />
            <StatusCell label="模型" value={digestStatus.digest?.model ?? "暂无"} />
            <StatusCell label="Tokens" value={digestStatus.digest?.tokenCost ?? 0} mono />
          </div>
          {digestStatus.latestRun?.error ? (
            <p className="break-words border-l-[3px] border-destructive bg-destructive/5 px-3 py-2 font-mono text-body-sm text-destructive">
              {digestStatus.latestRun.error}
            </p>
          ) : null}
        </ConsolePanel>

        <ConsolePanel
          label="错误流"
          badge={<CountChip tone={logs.length > 0 ? "danger" : "live"}>{logs.length}</CountChip>}
          bodyClassName={logs.length === 0 ? "p-4" : "p-0"}
        >
          {logs.length === 0 ? (
            <Empty className="gap-4 border border-dashed border-hairline bg-surface-soft py-12 shadow-none hover:shadow-none">
              <Empty.Icon className="flex h-11 w-11 items-center justify-center rounded-full bg-semantic-success/10 text-semantic-success">
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
            <ul className="divide-y divide-hairline">
              {logs.map((log) => (
                <ErrorLogItem key={log.id} log={log} />
              ))}
            </ul>
          )}
        </ConsolePanel>
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
  const isError = log.severity === "error";

  return (
    <li
      className={cn(
        "group relative flex gap-4 px-4 py-3.5 transition-colors hover:bg-surface-soft",
      )}
    >
      {/* severity spine */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          isError ? "bg-destructive" : "bg-brand-orange",
        )}
        aria-hidden
      />

      {/* timestamp rail */}
      <time
        dateTime={log.createdAt.toISOString()}
        className="w-16 shrink-0 pt-0.5 font-mono text-micro leading-relaxed text-steel"
      >
        {formatDate(log.createdAt)}
      </time>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={isError ? "solid" : "default"}
            size="sm"
            className={cn(
              "font-mono uppercase tracking-wider",
              isError && "bg-destructive text-white",
              !isError && "bg-brand-orange/12 text-brand-orange-deep dark:text-brand-orange",
            )}
          >
            {log.severity}
          </Badge>
          {log.errorName ? (
            <span className="font-mono text-micro font-medium text-charcoal">{log.errorName}</span>
          ) : null}
          <span className="font-mono text-micro text-stone">{log.operation}</span>
          <span className="ml-auto inline-flex items-center rounded-full border border-hairline bg-surface px-2 py-0.5 font-mono text-micro uppercase tracking-wider text-steel">
            {log.source}
          </span>
        </div>

        <p className="break-words text-body-sm text-ink">{log.message}</p>

        {upstream ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-micro text-charcoal">
            <span className="font-semibold text-destructive">
              ↑ {upstream.statusCode ?? "unknown"}
            </span>
            {upstream.url ? <span className="break-all text-steel">{upstream.url}</span> : null}
            {upstream.contentType ? <span className="text-stone">{upstream.contentType}</span> : null}
          </div>
        ) : null}

        {log.feedTitle || log.feedUrl ? (
          <p className="truncate text-micro text-steel">
            <span className="text-stone">订阅源 · </span>
            {log.feedTitle ?? log.feedUrl}
          </p>
        ) : null}

        {details !== "{}" ? (
          <details className="group/details">
            <summary className="inline-flex cursor-pointer items-center gap-1 font-mono text-micro font-medium text-primary hover:underline">
              <span className="transition-transform group-open/details:rotate-90">▸</span>
              details.json
            </summary>
            <pre className="console-scanline mt-2 max-h-72 overflow-auto border border-hairline bg-surface-soft p-3 font-mono text-micro leading-relaxed text-charcoal">
              {details}
            </pre>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function StatusCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-3 py-2.5">
      <span className="text-micro font-semibold uppercase tracking-[0.1em] text-steel">
        {label}
      </span>
      <span
        className={cn(
          "break-words text-body-sm-medium text-ink",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
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
