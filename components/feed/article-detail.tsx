"use client";

import Link from "next/link";
import { ExternalLink, MessagesSquare, FileText } from "lucide-react";
import { mockArticles } from "@/lib/mock/feed";
import { useFeedStore } from "@/lib/stores/feed";
import { Button } from "@/components/retroui/Button";
import { ImportanceBadge, TagChip } from "./article-badges";

/**
 * /feed 右栏 · 文章详情。
 * 全文(图片按 URL 展示,不向量化——锁定决策) + 完整 AI 摘要卡 + 标签 + 重要度。
 * 顶部「问 AI」把当前文章带入 /chat。
 */
export function ArticleDetail() {
  const selectedArticleId = useFeedStore((s) => s.selectedArticleId);
  const article = mockArticles.find((a) => a.id === selectedArticleId);

  if (!article) {
    return (
      <section className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex">
        <FileText size={32} className="text-muted-foreground" aria-hidden />
        <p className="text-body-sm text-muted-foreground">
          从中间列表选择一篇文章查看详情
        </p>
      </section>
    );
  }

  return (
    <article className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-end gap-2 border-b border-border px-6 py-3">
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <span>{article.feedTitle}</span>
            {article.author ? (
              <>
                <span aria-hidden>·</span>
                <span>{article.author}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleString("zh-CN")}
            </time>
          </div>
          <h1 className="font-head text-heading-3 font-semibold tracking-tight">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <ImportanceBadge value={article.importance} />
            {article.tags.map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        </header>

        <section className="card-feature-lavender flex flex-col gap-3">
          <span className="text-caption font-semibold uppercase tracking-wide text-brand-purple-800">
            AI 摘要
          </span>
          <p className="text-body-md">{article.summary}</p>
          {article.bullets.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm">
              {article.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            className="rounded-lg border border-border"
          />
        ) : null}

        <div className="text-body-md leading-relaxed text-foreground">
          {article.content}
        </div>
      </div>
    </article>
  );
}
