import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-head text-heading-5 font-semibold">rsxonhub</span>
        <ThemeToggle />
      </header>

      <main className="notion-container flex flex-1 flex-col items-start justify-center gap-6 py-16">
        <h1 className="font-head text-display-lg font-semibold tracking-tight">
          AI 增强的 RSS 阅读器
        </h1>
        <p className="max-w-xl text-subtitle text-muted-foreground">
          自动摘要与标签、每日简报,以及对整个订阅库的问答(带来源引用)。
          骨架已就位,下一步接入订阅与抓取。
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="badge-tag-purple">摘要</span>
          <span className="badge-tag-green">每日简报</span>
          <span className="badge-tag-orange">RAG 问答</span>
        </div>
      </main>
    </div>
  );
}
