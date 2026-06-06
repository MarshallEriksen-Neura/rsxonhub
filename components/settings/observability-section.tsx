import type { ReactNode } from "react";
import { Activity, Clock, Coins, DatabaseZap } from "lucide-react";
import type { getSettingsObservabilitySnapshot } from "@/app/(app)/settings/actions";
import { EmbeddingRebuildButton } from "./embedding-rebuild-button";
import { SectionHeader } from "./section-header";

type ObservabilitySnapshot = Awaited<ReturnType<typeof getSettingsObservabilitySnapshot>>;

export function ObservabilitySection({ snapshot }: { snapshot: ObservabilitySnapshot }) {
  return (
    <section>
      <SectionHeader
        title="运行观测"
        desc="查看抓取、向量重建和 AI 用量的最近状态。"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={Clock} title="最近抓取运行">
          {snapshot.recentFetchRuns.length === 0 ? (
            <EmptyLine text="还没有抓取运行记录" />
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {snapshot.recentFetchRuns.map((run) => (
                <li key={run.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-body-sm font-medium text-ink">
                      {run.feedTitle}
                    </div>
                    <div className="mt-1 text-micro text-steel">
                      {formatDate(run.startedAt)} · {run.itemCount} 条 · 新增 {run.insertedCount} · 更新 {run.updatedCount}
                    </div>
                    {run.error ? (
                      <div className="mt-1 truncate text-micro text-destructive">{run.error}</div>
                    ) : null}
                  </div>
                  <StatusPill status={run.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={DatabaseZap}
          title="向量重建"
          action={<EmbeddingRebuildButton className="gap-1.5" />}
        >
          {snapshot.latestRebuild ? (
            <div className="flex flex-col gap-2 py-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-body-sm font-medium text-ink">
                  #{snapshot.latestRebuild.id} · {snapshot.latestRebuild.model}
                </div>
                <StatusPill status={snapshot.latestRebuild.status} />
              </div>
              <div className="text-micro text-steel">
                {snapshot.latestRebuild.articleCount} 篇文章 · {snapshot.latestRebuild.chunkCount} chunks · {snapshot.latestRebuild.dimension} 维
              </div>
              <div className="text-micro text-steel">
                创建于 {formatDate(snapshot.latestRebuild.createdAt)}
              </div>
              {snapshot.latestRebuild.error ? (
                <div className="text-micro text-destructive">{snapshot.latestRebuild.error}</div>
              ) : null}
            </div>
          ) : (
            <EmptyLine text="还没有向量重建记录" />
          )}
        </Panel>

        <Panel icon={Coins} title="AI 用量汇总">
          {snapshot.usageTotals.length === 0 ? (
            <EmptyLine text="还没有用量记录" />
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {snapshot.usageTotals.map((row) => (
                <li key={`${row.kind}:${row.model ?? "unknown"}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-body-sm font-medium text-ink">
                      {row.kind} · {row.model ?? "unknown"}
                    </div>
                    <div className="mt-1 text-micro text-steel">{row.calls} 次调用</div>
                  </div>
                  <div className="text-right text-micro text-steel">
                    <div>{row.tokens} tokens</div>
                    <div>{row.cost.toFixed(4)} cost</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Activity;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-background p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-body-sm font-medium text-ink">
          <Icon size={16} className="text-primary" aria-hidden />
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-micro font-medium text-steel">
      {status}
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="py-3 text-body-sm text-steel">{text}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
