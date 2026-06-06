import { FeedStatsCharts } from "@/components/stats/feed-stats-charts";

export default function StatsPage() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-canvas px-4 py-5 lg:px-6 lg:py-6">
      <FeedStatsCharts />
    </main>
  );
}
