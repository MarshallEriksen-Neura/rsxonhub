"use client";

import { useEffect, useState } from "react";
import { Activity, BookOpen, Rss, TriangleAlert } from "lucide-react";
import { BarChart } from "@/components/retroui/charts/BarChart";
import { LineChart } from "@/components/retroui/charts/LineChart";
import {
  ConsoleHeader,
  ConsolePanel,
  CountChip,
  MetricCard,
} from "@/components/console/console-kit";

type FeedStat = {
  id: number;
  title: string;
  articleCount: number;
  readCount: number;
  readRate: number;
  successRuns: number;
  failedRuns: number;
  hasError: boolean;
  daysSinceSuccess: number | null;
};

type DailyArticle = { day: string; count: number };

type ApiResponse = { feeds: FeedStat[]; dailyArticles: DailyArticle[] };

const CHART_GRID = "color-mix(in srgb, var(--notion-color-hairline) 80%, transparent)";

export function FeedStatsCharts() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/feeds")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <ConsoleHeader
        kicker="ANALYTICS · 订阅遥测"
        title="订阅统计"
        subtitle="近 30 天产量、阅读转化与抓取健康度的聚合视图。"
        status={
          error
            ? { tone: "danger", label: "加载失败" }
            : data
              ? { tone: "live", label: "已同步", pulse: false }
              : { tone: "info", label: "加载中", pulse: true }
        }
      />

      {error ? (
        <ConsolePanel label="错误" bodyClassName="p-4">
          <p className="font-mono text-body-sm text-destructive">{error}</p>
        </ConsolePanel>
      ) : !data ? (
        <SkeletonState />
      ) : (
        <LoadedStats data={data} />
      )}
    </div>
  );
}

function LoadedStats({ data }: { data: ApiResponse }) {
  const { feeds, dailyArticles } = data;

  const totalArticles = feeds.reduce((sum, f) => sum + f.articleCount, 0);
  const totalRead = feeds.reduce((sum, f) => sum + f.readCount, 0);
  const avgReadRate = totalArticles > 0 ? Math.round((totalRead / totalArticles) * 100) : 0;
  const errorFeeds = feeds.filter((f) => f.hasError);

  const productivityData = feeds
    .slice(0, 15)
    .map((f) => ({ name: f.title.slice(0, 16), 文章数: f.articleCount, 已读: f.readCount }));

  const healthData = feeds
    .filter((f) => f.daysSinceSuccess !== null)
    .sort((a, b) => (b.daysSinceSuccess ?? 0) - (a.daysSinceSuccess ?? 0))
    .slice(0, 15)
    .map((f) => ({ name: f.title.slice(0, 16), 距上次成功天数: f.daysSinceSuccess ?? 0 }));

  const trendData = dailyArticles.map((d) => ({ day: d.day, 新文章: d.count }));

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Rss}
          label="订阅源"
          value={feeds.length.toLocaleString("zh-CN")}
          tone="info"
          delay={0}
        />
        <MetricCard
          icon={BookOpen}
          label="新文章 · 30天"
          value={totalArticles.toLocaleString("zh-CN")}
          hint={`已读 ${totalRead.toLocaleString("zh-CN")}`}
          tone="neutral"
          delay={60}
        />
        <MetricCard
          icon={Activity}
          label="平均阅读率"
          value={`${avgReadRate}%`}
          tone={avgReadRate >= 50 ? "live" : "neutral"}
          delay={120}
        />
        <MetricCard
          icon={TriangleAlert}
          label="异常订阅源"
          value={errorFeeds.length.toLocaleString("zh-CN")}
          tone={errorFeeds.length > 0 ? "danger" : "live"}
          delay={180}
        />
      </section>

      <ConsolePanel label="近 30 天文章趋势">
        <LineChart
          data={trendData}
          index="day"
          categories={["新文章"]}
          strokeColors={["var(--primary)"]}
          gridColor={CHART_GRID}
          className="h-52"
        />
      </ConsolePanel>

      <ConsolePanel label="文章产量 & 阅读量 · Top 15">
        <BarChart
          data={productivityData}
          index="name"
          categories={["文章数", "已读"]}
          fillColors={["var(--primary)", "var(--notion-color-brand-teal)"]}
          strokeColors={["transparent"]}
          gridColor={CHART_GRID}
          alignment="horizontal"
          className="h-96"
        />
      </ConsolePanel>

      <ConsolePanel label="Feed 健康 · 距上次成功抓取天数">
        <BarChart
          data={healthData}
          index="name"
          categories={["距上次成功天数"]}
          fillColors={["var(--notion-color-brand-orange)"]}
          strokeColors={["transparent"]}
          gridColor={CHART_GRID}
          alignment="horizontal"
          className="h-96"
        />
      </ConsolePanel>

      {errorFeeds.length > 0 && (
        <ConsolePanel
          label="抓取异常的订阅源"
          badge={<CountChip tone="danger">{errorFeeds.length}</CountChip>}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-hairline">
            {errorFeeds.map((f) => (
              <li
                key={f.id}
                className="group relative flex items-center gap-3 py-2.5 pl-4 pr-4 transition-colors hover:bg-surface-soft"
              >
                <span className="absolute inset-y-0 left-0 w-[3px] bg-destructive" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{f.title}</span>
                <span className="shrink-0 font-mono text-micro tabular-nums text-steel">
                  <span className="text-semantic-success">✓{f.successRuns}</span>
                  <span className="mx-1 text-stone">/</span>
                  <span className="text-destructive">✗{f.failedRuns}</span>
                  {f.daysSinceSuccess !== null ? (
                    <span className="ml-2 text-stone">{f.daysSinceSuccess}d ago</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </ConsolePanel>
      )}
    </>
  );
}

function SkeletonState() {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[5.5rem] animate-pulse border border-hairline bg-surface-soft"
          />
        ))}
      </section>
      <div className="h-64 animate-pulse border border-hairline bg-surface-soft" />
      <div className="h-[26rem] animate-pulse border border-hairline bg-surface-soft" />
    </>
  );
}
