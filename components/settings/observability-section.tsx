import { Clock, Coins, Layers } from "lucide-react";
import type { getSettingsObservabilitySnapshot } from "@/app/(app)/settings/actions";
import {
  ConsolePanel,
  CountChip,
  MetricCard,
  StatusPip,
  type ConsoleTone,
} from "@/components/console/console-kit";
import { cn } from "@/lib/utils";
import { EmbeddingRebuildButton } from "./embedding-rebuild-button";

type ObservabilitySnapshot = Awaited<ReturnType<typeof getSettingsObservabilitySnapshot>>;

export function ObservabilitySection({ snapshot }: { snapshot: ObservabilitySnapshot }) {
  const runs = snapshot.recentFetchRuns;
  const failedRuns = runs.filter((r) => r.status === "failed" || Boolean(r.error)).length;
  const totalTokens = snapshot.usageTotals.reduce((sum, r) => sum + Number(r.tokens), 0);
  const totalCost = snapshot.usageTotals.reduce((sum, r) => sum + Number(r.cost), 0);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 pb-1">
        <span className="text-micro font-semibold uppercase tracking-[0.18em] text-stone">
          TELEMETRY · 运行观测
        </span>
        <h2 className="font-head text-heading-4 font-semibold text-ink">运行观测</h2>
        <p className="text-body-sm text-steel">查看抓取、向量重建和 AI 用量的最近状态。</p>
      </div>

      {/* hero metric strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Clock}
          label="近期抓取"
          value={runs.length.toLocaleString("zh-CN")}
          hint={failedRuns > 0 ? `${failedRuns} 个失败` : "全部正常"}
          tone={failedRuns > 0 ? "danger" : "live"}
          delay={0}
        />
        <MetricCard
          icon={Layers}
          label="向量维度"
          value={snapshot.latestRebuild ? snapshot.latestRebuild.dimension.toLocaleString("zh-CN") : "—"}
          hint={snapshot.latestRebuild ? `${snapshot.latestRebuild.chunkCount} chunks` : "未重建"}
          tone={snapshot.latestRebuild ? "info" : "neutral"}
          delay={60}
        />
        <MetricCard
          icon={Coins}
          label="累计 Tokens"
          value={compactNumber(totalTokens)}
          tone="neutral"
          delay={120}
        />
        <MetricCard
          icon={Coins}
          label="累计成本"
          value={totalCost.toFixed(4)}
          tone={totalCost > 0 ? "warning" : "neutral"}
          delay={180}
        />
      </div>

      <ConsolePanel
        label="最近抓取运行"
        badge={<CountChip tone={failedRuns > 0 ? "danger" : "live"}>{runs.length}</CountChip>}
        bodyClassName="p-0"
      >
        {runs.length === 0 ? (
          <EmptyLine text="还没有抓取运行记录" />
        ) : (
          <ul className="divide-y divide-hairline-soft">
            {runs.map((run) => {
              const isErr = run.status === "failed" || Boolean(run.error);
              return (
                <li
                  key={run.id}
                  className="group relative flex items-start justify-between gap-3 py-3 pl-4 pr-4 transition-colors hover:bg-surface-soft"
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px]",
                      isErr ? "bg-destructive" : "bg-semantic-success",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate text-body-sm font-medium text-ink">
                      {run.feedTitle}
                    </div>
                    <div className="mt-1 font-mono text-micro text-steel">
                      {formatDate(run.startedAt)} · {run.itemCount} 条 · +{run.insertedCount} / ~{run.updatedCount}
                    </div>
                    {run.error ? (
                      <div className="mt-1 truncate font-mono text-micro text-destructive">
                        {run.error}
                      </div>
                    ) : null}
                  </div>
                  <RunStatus status={run.status} />
                </li>
              );
            })}
          </ul>
        )}
      </ConsolePanel>

      <ConsolePanel
        label="向量重建"
        action={<EmbeddingRebuildButton className="gap-1.5" />}
      >
        {snapshot.latestRebuild ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-body-sm font-medium text-ink">
                #{snapshot.latestRebuild.id} · {snapshot.latestRebuild.model}
              </div>
              <RunStatus status={snapshot.latestRebuild.status} />
            </div>
            <div className="grid gap-px overflow-hidden border border-hairline bg-hairline sm:grid-cols-3">
              <KvCell label="文章" value={snapshot.latestRebuild.articleCount} />
              <KvCell label="Chunks" value={snapshot.latestRebuild.chunkCount} />
              <KvCell label="维度" value={snapshot.latestRebuild.dimension} />
            </div>
            <div className="font-mono text-micro text-stone">
              创建于 {formatDate(snapshot.latestRebuild.createdAt)}
            </div>
            {snapshot.latestRebuild.error ? (
              <div className="border-l-[3px] border-destructive bg-destructive/5 px-3 py-2 font-mono text-micro text-destructive">
                {snapshot.latestRebuild.error}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyLine text="还没有向量重建记录" />
        )}
      </ConsolePanel>

      <ConsolePanel
        label="AI 用量汇总"
        badge={<CountChip>{snapshot.usageTotals.length}</CountChip>}
        bodyClassName="p-0"
      >
        {snapshot.usageTotals.length === 0 ? (
          <EmptyLine text="还没有用量记录" />
        ) : (
          <ul className="divide-y divide-hairline-soft">
            {snapshot.usageTotals.map((row) => (
              <li
                key={`${row.kind}:${row.model ?? "unknown"}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <UsageKindTag kind={row.kind} />
                    <span className="truncate font-mono text-body-sm font-medium text-ink">
                      {row.model ?? "unknown"}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-micro text-steel">{row.calls} 次调用</div>
                </div>
                <div className="text-right font-mono text-micro tabular-nums text-steel">
                  <div className="text-charcoal">{compactNumber(Number(row.tokens))} tok</div>
                  <div className="text-stone">{Number(row.cost).toFixed(4)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ConsolePanel>
    </section>
  );
}

function RunStatus({ status }: { status: string }) {
  const tone: ConsoleTone =
    status === "error" || status === "failed"
      ? "danger"
      : status === "success" || status === "completed"
        ? "live"
        : status === "running" || status === "pending"
          ? "info"
          : "neutral";
  return <StatusPip tone={tone} label={status} pulse={tone === "info"} />;
}

function UsageKindTag({ kind }: { kind: string }) {
  return (
    <span className="inline-flex items-center rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-micro uppercase tracking-wider text-steel">
      {kind}
    </span>
  );
}

function KvCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card px-3 py-2">
      <span className="text-micro font-semibold uppercase tracking-[0.1em] text-steel">
        {label}
      </span>
      <span className="font-mono text-body-sm-medium tabular-nums text-ink">
        {value.toLocaleString("zh-CN")}
      </span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="px-4 py-4 text-body-sm text-steel">{text}</div>;
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("zh-CN");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
