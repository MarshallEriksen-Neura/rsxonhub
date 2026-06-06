import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/retroui/Button";
import {
  ConsolePanel,
  SectionLabel,
  StatusPip,
  type ConsoleTone,
} from "@/components/console/console-kit";
import { getDailyDigest } from "@/lib/digest/generate-digest";
import { getLatestDigestStatus } from "@/lib/digest/runs";
import { getScheduleLocalDate } from "@/lib/datetime";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  generateYesterdayDigest,
  refreshDigestCandidates,
  regenerateTodayDigest,
} from "./actions";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

export default async function DigestPage() {
  const digestDate = getScheduleLocalDate(env.DIGEST_TIMEZONE);
  const [data, status] = await Promise.all([
    getDailyDigest(digestDate),
    getLatestDigestStatus(digestDate),
  ]);

  const date = parseLocalDate(digestDate);

  return (
    <main className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8 lg:py-10">
        {/* ── Masthead: date-forward editorial header ── */}
        <header className="flex flex-col gap-4 border-b border-hairline-strong pb-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-micro font-semibold uppercase tracking-[0.22em] text-stone">
              每日精选 · DAILY BRIEFING
            </span>
            <StatusPip
              tone={data ? "live" : "warning"}
              label={data ? "已生成" : "等待生成"}
              pulse={!data}
            />
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[3.25rem] font-semibold leading-none tabular-nums text-ink">
                {date.day}
              </span>
              <div className="flex flex-col gap-0.5 pb-1">
                <span className="text-body-md-medium text-ink">{date.monthLabel}</span>
                <span className="font-mono text-micro text-steel">
                  {date.year} · {date.weekday}
                </span>
              </div>
            </div>
            <span className="font-mono text-micro text-stone">{env.DIGEST_TIMEZONE}</span>
          </div>
        </header>

        {/* ── Lede: the briefing itself, hero editorial ── */}
        {!data ? (
          <section className="border border-dashed border-hairline bg-surface-soft px-6 py-10 text-center">
            <h2 className="mb-2 text-heading-5 text-ink">今天的简报还没有生成</h2>
            <p className="mx-auto max-w-md text-body-sm leading-relaxed text-steel">
              后台 worker 会从兴趣画像和检索候选中生成日报。请确认订阅源已抓取、兴趣画像已保存,并运行 worker。
            </p>
          </section>
        ) : (
          <article className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.16em] text-primary">
                <span className="h-3 w-[3px] rounded-full bg-primary" aria-hidden />
                今日头条
              </span>
              <h1 className="font-head text-heading-2 font-semibold leading-tight tracking-tight text-ink-deep text-balance">
                {data.digest.title ?? "今日简报"}
              </h1>
            </div>
            <p className="border-l-2 border-hairline-strong pl-5 text-subtitle leading-relaxed text-charcoal">
              {data.digest.summary}
            </p>
            <div className="flex items-center gap-2 font-mono text-micro text-stone">
              <span>{data.digest.model ?? "unknown"}</span>
              <span aria-hidden>·</span>
              <span>{data.digest.tokenCost ?? 0} tokens</span>
            </div>
          </article>
        )}

        {/* ── Reading list: numbered editorial rail ── */}
        {data ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <SectionLabel>入选文章</SectionLabel>
              <span className="font-mono text-micro tabular-nums text-stone">
                {String(data.items.length).padStart(2, "0")} 篇
              </span>
            </div>
            <ol className="flex flex-col">
              {data.items.map((item, index) => (
                <li
                  key={item.articleId}
                  className="group relative flex gap-4 border-t border-hairline py-5 first:border-t-0 first:pt-0"
                >
                  {/* index rail */}
                  <span
                    className="shrink-0 select-none pt-0.5 font-mono text-body-sm font-semibold tabular-nums text-stone transition-colors group-hover:text-primary"
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/feed?article=${item.articleId}`}
                          className="text-body-md-medium text-foreground no-underline transition-colors hover:text-primary"
                        >
                          {item.title ?? "未命名文章"}
                        </Link>
                        <div className="mt-1 font-mono text-micro text-steel">
                          {item.feedTitle ?? "未命名订阅源"}
                          {item.publishedAt
                            ? ` · ${item.publishedAt.toLocaleString("zh-CN")}`
                            : ""}
                        </div>
                      </div>
                      {item.importance != null ? (
                        <ImportanceMark value={item.importance} />
                      ) : null}
                    </div>

                    <p className="text-body-sm leading-relaxed text-charcoal">
                      {item.reason ?? item.aiSummary ?? item.summaryRaw ?? "无摘要"}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.tags?.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-hairline bg-surface px-2 py-0.5 text-micro text-steel"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 font-mono text-micro font-medium text-primary no-underline hover:underline"
                        >
                          原文 ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* ── Ops control strip: telemetry + actions, console kit ── */}
        <ConsolePanel
          label="生成控制"
          badge={
            <StatusPip {...runStatusProps(status.latestRun)} />
          }
          bodyClassName="flex flex-col gap-4"
        >
          <div className="grid gap-px overflow-hidden border border-hairline bg-hairline sm:grid-cols-3">
            <StatusItem label="最近运行" value={formatRun(status.latestRun)} mono />
            <StatusItem label="入选文章" value={status.digest?.selectedCount ?? 0} mono />
            <StatusItem
              label="模型 / Tokens"
              value={
                status.digest
                  ? `${status.digest.model ?? "unknown"} / ${status.digest.tokenCost ?? 0}`
                  : "暂无"
              }
              mono
            />
          </div>
          {status.latestRun?.error ? (
            <p className="break-words border-l-[3px] border-destructive bg-destructive/5 px-3 py-2 font-mono text-body-sm text-destructive">
              {status.latestRun.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={regenerateTodayDigest}>
              <Button size="sm" type="submit">
                重新生成今日精选
              </Button>
            </form>
            <form action={generateYesterdayDigest}>
              <Button size="sm" variant="outline" type="submit">
                生成昨天
              </Button>
            </form>
            <form action={refreshDigestCandidates}>
              <Button size="sm" variant="secondary" type="submit">
                刷新候选
              </Button>
            </form>
          </div>
        </ConsolePanel>
      </div>
    </main>
  );
}

/** Importance shown as a compact ranked weight, not a flat badge. */
function ImportanceMark({ value }: { value: number }) {
  const tone: ConsoleTone = value >= 80 ? "danger" : value >= 50 ? "warning" : "info";
  const color =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-brand-orange-deep dark:text-brand-orange"
        : "text-primary";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-0.5 font-mono tabular-nums",
        color,
      )}
      title={`重要度 ${value}`}
    >
      <span className="text-body-sm-medium">{value}</span>
      <span className="text-micro text-stone">/100</span>
    </span>
  );
}

function StatusItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-3 py-2.5">
      <span className="text-micro font-semibold uppercase tracking-[0.1em] text-steel">
        {label}
      </span>
      <span className={cn("break-words text-body-sm-medium text-ink", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

function runStatusProps(
  run: Awaited<ReturnType<typeof getLatestDigestStatus>>["latestRun"],
): { tone: ConsoleTone; label: string; pulse?: boolean } {
  if (!run) return { tone: "neutral", label: "暂无运行" };
  if (run.status === "failed") return { tone: "danger", label: `${run.phase} / failed` };
  if (run.status === "skipped") return { tone: "warning", label: `${run.phase} / skipped` };
  if (!run.finishedAt) return { tone: "info", label: `${run.phase} / running`, pulse: true };
  return { tone: "live", label: `${run.phase} / ${run.status}` };
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const monthNames = [
    "1 月",
    "2 月",
    "3 月",
    "4 月",
    "5 月",
    "6 月",
    "7 月",
    "8 月",
    "9 月",
    "10 月",
    "11 月",
    "12 月",
  ];
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return {
    year,
    day: String(day).padStart(2, "0"),
    monthLabel: monthNames[month - 1] ?? `${month} 月`,
    weekday,
  };
}

function formatRun(run: Awaited<ReturnType<typeof getLatestDigestStatus>>["latestRun"]) {
  if (!run) return "暂无";
  const finishedAt = run.finishedAt ? run.finishedAt.toLocaleString("zh-CN") : "未完成";
  return `${run.phase} / ${run.status} / ${finishedAt}`;
}
