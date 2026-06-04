"use client";

import Link from "next/link";
import { ExternalLink, MessagesSquare, FileText, Sparkles } from "lucide-react";
import { mockArticles, type Importance } from "@/lib/mock/feed";
import { useFeedStore } from "@/lib/stores/feed";
import { Button } from "@/components/retroui/Button";
import { Badge } from "@/components/retroui/Badge";

// 重要性徽章变体配置
const importanceVariantMap: Record<Importance, "outline" | "surface" | "default"> = {
  high: "outline",
  medium: "surface",
  low: "default",
};

const importanceLabelMap: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/**
 * /feed 右栏 · 文章详情。
 * 改进:
 * - 更清晰的视觉层次和间距
 * - AI 摘要框使用统一的左边框强调，而非突兀的背景色
 * - 更好的字体大小和行高
 * - 统一的标签样式
 */
export function ArticleDetail() {
  const selectedArticleId = useFeedStore((s) => s.selectedArticleId);
  const article = mockArticles.find((a) => a.id === selectedArticleId);

  if (!article) {
    return (
      <section className="hidden flex-1 flex-col items-center justify-center gap-4 p-8 text-center md:flex">
        <div className="grid size-16 place-items-center rounded-full bg-surface text-stone">
          <FileText size={28} aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-medium text-charcoal">选择一篇文章查看详情</p>
          <p className="text-caption text-steel">从中间列表点击任意文章</p>
        </div>
      </section>
    );
  }

  return (
    <article className="flex flex-1 flex-col overflow-y-auto bg-background">
      {/* 顶部操作栏 */}
      <div className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-hairline bg-background/80 px-6 py-3 backdrop-blur-sm">
        <Button
          size="sm"
          variant="outline"
          render={
            <Link href={`/chat?article=${article.id}`}>
              <MessagesSquare size={15} aria-hidden />
              问 AI
            </Link>
          }
        />
        <Button
          size="sm"
          variant="ghost"
          render={
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} aria-hidden />
              原文
            </a>
          }
        />
      </div>

      {/* 文章内容 */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
        {/* 文章头部 */}
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs text-steel">
            <span className="font-medium text-charcoal">{article.feedTitle}</span>
            {article.author ? (
              <>
                <span aria-hidden className="text-stone">·</span>
                <span>{article.author}</span>
              </>
            ) : null}
            <span aria-hidden className="text-stone">·</span>
            <time dateTime={article.publishedAt} className="text-stone">
              {new Date(article.publishedAt).toLocaleString("zh-CN")}
            </time>
          </div>

          <h1 className="font-head text-heading-3 font-semibold tracking-tight text-ink-deep leading-tight">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={importanceVariantMap[article.importance]} size="sm">
              {importanceLabelMap[article.importance]}
            </Badge>
            {article.tags.map((tag) => (
              <Badge key={tag} variant="default" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </header>

        {/* AI 摘要 */}
        <section className="flex flex-col gap-4 rounded-lg border-l-4 border-primary bg-primary/5 p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-steel">
              AI 摘要
            </span>
          </div>
          <p className="text-body-md leading-relaxed text-charcoal">
            {article.summary}
          </p>
          {article.bullets.length > 0 ? (
            <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm leading-relaxed text-slate">
              {article.bullets.map((b, i) => (
                <li key={i} className="marker:text-primary">{b}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* 文章图片 */}
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            className="rounded-lg border border-hairline"
          />
        ) : null}

        {/* 文章正文 */}
        <div className="text-body-md leading-relaxed text-charcoal space-y-4">
          {article.content}
        </div>
      </div>
    </article>
  );
}
