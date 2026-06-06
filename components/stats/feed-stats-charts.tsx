"use client";

import { useEffect, useState } from "react";
import { BarChart } from "@/components/retroui/charts/BarChart";
import { LineChart } from "@/components/retroui/charts/LineChart";

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

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
    />
  );
}

export function FeedStatsCharts() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/feeds")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-destructive text-body-sm">{error}</p>;
  if (!data) return <p className="text-steel text-body-sm">加载中…</p>;

  const { feeds, dailyArticles } = data;

  // 文章产量 Top 15（水平条形图）
  const productivityData = feeds
    .slice(0, 15)
    .map((f) => ({ name: f.title.slice(0, 16), 文章数: f.articleCount, 已读: f.readCount }));

  // 健康状态（距上次成功天数，越大越危险）
  const healthData = feeds
    .filter((f) => f.daysSinceSuccess !== null)
    .sort((a, b) => (b.daysSinceSuccess ?? 0) - (a.daysSinceSuccess ?? 0))
    .slice(0, 15)
    .map((f) => ({ name: f.title.slice(0, 16), 距上次成功天数: f.daysSinceSuccess ?? 0 }));

  // 报错的 feed
  const errorFeeds = feeds.filter((f) => f.hasError);

  // 日趋势折线图
  const trendData = dailyArticles.map((d) => ({ day: d.day, 新文章: d.count }));

  return (
    <div className="flex flex-col gap-8">
      {/* 近 30 天每日新文章趋势 */}
      <section>
        <h2 className="mb-3 text-body-md-medium text-ink">近 30 天文章趋势</h2>
        <div className="border border-hairline bg-surface p-4">
          <LineChart
            data={trendData}
            index="day"
            categories={["新文章"]}
            className="h-52"
          />
        </div>
      </section>

      {/* 文章产量 + 阅读量 Top 15 */}
      <section>
        <h2 className="mb-3 text-body-md-medium text-ink">订阅源文章产量 & 阅读量（Top 15，近 30 天）</h2>
        <div className="border border-hairline bg-surface p-4">
          <BarChart
            data={productivityData}
            index="name"
            categories={["文章数", "已读"]}
            alignment="horizontal"
            className="h-96"
          />
        </div>
      </section>

      {/* Feed 健康：距上次成功抓取天数 */}
      <section>
        <h2 className="mb-3 text-body-md-medium text-ink">Feed 健康 — 距上次成功抓取天数</h2>
        <div className="border border-hairline bg-surface p-4">
          <BarChart
            data={healthData}
            index="name"
            categories={["距上次成功天数"]}
            alignment="horizontal"
            className="h-96"
          />
        </div>
      </section>

      {/* 有报错的 Feed 列表 */}
      {errorFeeds.length > 0 && (
        <section>
          <h2 className="mb-3 text-body-md-medium text-ink">
            抓取异常的订阅源
            <span className="ml-2 text-micro text-destructive">({errorFeeds.length})</span>
          </h2>
          <ul className="divide-y divide-hairline border border-hairline">
            {errorFeeds.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-body-sm">
                <StatusDot ok={false} />
                <span className="min-w-0 flex-1 truncate text-ink">{f.title}</span>
                <span className="shrink-0 text-micro text-steel">
                  成功 {f.successRuns} / 失败 {f.failedRuns}
                  {f.daysSinceSuccess !== null ? ` · ${f.daysSinceSuccess}天前` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
