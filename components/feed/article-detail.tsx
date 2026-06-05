"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  MessagesSquare,
  FileText,
  Sparkles,
  ChevronDown,
  X,
  Star,
} from "lucide-react";
import { Dialog } from "@/components/retroui/Dialog";
import { type Importance } from "@/lib/mock/feed";
import type { ArticleView } from "@/components/feed/article-list";
import { useFeedStore } from "@/lib/stores/feed";
import { useAiSummaryStore } from "@/lib/stores/ai-summary";
import { Button } from "@/components/retroui/Button";
import { Badge } from "@/components/retroui/Badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleContent } from "@/components/feed/article-content";
import { cn } from "@/lib/utils";

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
  const [article, setArticle] = useState<ArticleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [starred, setStarred] = useState(false);
  const openLightbox = (src: string) => setLightbox(src);

  useEffect(() => {
    if (!selectedArticleId) {
      return;
    }

    let cancelled = false;
    async function loadArticle() {
      try {
        setError(null);
        const response = await fetch(`/api/articles?articleId=${selectedArticleId}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "文章加载失败");
        }
        if (!cancelled) {
          const loaded = payload.articles[0] ?? null;
          setArticle(loaded);
          setStarred(loaded?.status === "star");
          setHeroImageLoaded(false);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadArticle();
    return () => {
      cancelled = true;
    };
  }, [selectedArticleId]);

  const visibleArticle =
    selectedArticleId && article?.id === selectedArticleId ? article : null;

  if (!visibleArticle) {
    return (
      <section className="hidden flex-1 flex-col items-center justify-center gap-4 p-8 text-center md:flex">
        <div className="grid size-16 place-items-center rounded-full bg-surface text-stone">
          <FileText size={28} aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-medium text-charcoal">
            {error ?? "选择一篇文章查看详情"}
          </p>
          <p className="text-caption text-steel">
            {error ? "请稍后重试" : "从中间列表点击任意文章"}
          </p>
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
          variant="ghost"
          aria-label={starred ? "取消收藏" : "收藏"}
          onClick={async () => {
            const next = starred ? "read" : "star";
            setStarred(!starred);
            try {
              await fetch("/api/articles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ articleId: visibleArticle.id, status: next }),
              });
            } catch {
              setStarred(starred);
            }
          }}
          className={starred ? "text-amber-400" : ""}
        >
          <Star size={15} fill={starred ? "currentColor" : "none"} aria-hidden />
          {starred ? "已收藏" : "收藏"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          render={
            <Link href={`/chat?article=${visibleArticle.id}`}>
              <MessagesSquare size={15} aria-hidden />
              问 AI
            </Link>
          }
        />
        <Button
          size="sm"
          variant="ghost"
          render={
            <a href={visibleArticle.url ?? "#"} target="_blank" rel="noopener noreferrer">
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
            <span className="font-medium text-charcoal">{visibleArticle.feedTitle}</span>
            {visibleArticle.author ? (
              <>
                <span aria-hidden className="text-stone">·</span>
                <span>{visibleArticle.author}</span>
              </>
            ) : null}
            <span aria-hidden className="text-stone">·</span>
            <time dateTime={visibleArticle.publishedAt} className="text-stone">
              {new Date(visibleArticle.publishedAt).toLocaleString("zh-CN")}
            </time>
          </div>

          <h1 className="font-head text-heading-3 font-semibold tracking-tight text-ink-deep leading-tight">
            {visibleArticle.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={importanceVariantMap[visibleArticle.importance]} size="sm">
              {importanceLabelMap[visibleArticle.importance]}
            </Badge>
            {visibleArticle.tags.map((tag) => (
              <Badge key={tag} variant="default" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </header>

        {/* AI 摘要(按需加载) */}
        <AiSummary article={visibleArticle} />

        {/* 文章题图(点击可放大) */}
        {visibleArticle.imageUrl ? (
          <MediaLightbox src={visibleArticle.imageUrl} alt={visibleArticle.title ?? ""}>
            <div className="relative overflow-hidden rounded-lg border border-hairline bg-surface">
              {!heroImageLoaded ? (
                <Skeleton className="absolute inset-0 h-full min-h-56 w-full rounded-lg" />
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visibleArticle.imageUrl}
                alt={visibleArticle.title ?? ""}
                loading="lazy"
                onLoad={() => setHeroImageLoaded(true)}
                onError={() => setHeroImageLoaded(true)}
                className={cn(
                  "block w-full cursor-zoom-in transition-opacity hover:opacity-90",
                  heroImageLoaded ? "opacity-100" : "min-h-56 opacity-0",
                )}
              />
            </div>
          </MediaLightbox>
        ) : null}

        {/* 文章正文(已净化的 RSS HTML:图片/视频/嵌入按 .prose-article 排版) */}
        <ArticleContent html={visibleArticle.content} onMediaClick={openLightbox} />

        {/* 全局 lightbox */}
        <MediaLightboxDialog
          src={lightbox}
          onClose={() => setLightbox(null)}
        />
      </div>
    </article>
  );
}

/**
 * AI 摘要 · 按需加载。
 * 默认折叠,只显示一个触发按钮;点击后才"请求"后端摘要,
 * 等待期间用 Skeleton 占位,返回后展示摘要正文与要点。
 * 加载状态按文章 id 缓存(见 ai-summary store),切回不重复请求。
 */
function AiSummary({ article }: { article: ArticleView }) {
  const status = useAiSummaryStore((s) => s.status[article.id] ?? "idle");
  const expanded = useAiSummaryStore((s) => s.expanded[article.id] ?? false);
  const toggle = useAiSummaryStore((s) => s.toggle);

  const isLoading = status === "loading";
  const isReady = status === "ready";

  return (
    <section className="flex flex-col rounded-lg border-l-4 border-primary bg-primary/5">
      {/* 触发头:点击切换显隐 */}
      <button
        type="button"
        onClick={() => toggle(article.id)}
        aria-expanded={expanded}
        className="flex items-center gap-2 rounded-r-lg px-5 py-4 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Sparkles size={16} className="text-primary" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wider text-steel">
          AI 摘要
        </span>
        {!expanded ? (
          <span className="text-caption text-stone">点击生成</span>
        ) : null}
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "ml-auto text-stone transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* 展开区:loading 用 Skeleton 占位,ready 显示摘要 */}
      {expanded ? (
        <div className="flex flex-col gap-4 px-5 pb-5">
          {isLoading ? (
            <div className="flex flex-col gap-3" aria-busy aria-live="polite">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <div className="mt-1 flex flex-col gap-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ) : null}

          {isReady ? (
            <>
              <p className="text-body-md leading-relaxed text-charcoal">
                {article.summary}
              </p>
              {article.bullets.length > 0 ? (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm leading-relaxed text-slate">
                  {article.bullets.map((b, i) => (
                    <li key={i} className="marker:text-primary">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** 封面图点击触发 lightbox 的包装 */
function MediaLightbox({
  src,
  alt,
  children,
}: {
  src: string;
  alt: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <Dialog.Trigger className="block w-full" aria-label="查看大图">
        <figure className="m-0">{children}</figure>
      </Dialog.Trigger>
      <Dialog.Content size="4xl" className="bg-black/90 border-0 p-0">
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black/80"
          aria-label="关闭"
        >
          <Dialog.Close className="flex">
            <X size={20} aria-hidden />
          </Dialog.Close>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[90vh] w-full object-contain" />
      </Dialog.Content>
    </Dialog>
  );
}

/** 正文内图片/视频的全局 lightbox（受控） */
function MediaLightboxDialog({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  if (!src) return null;
  const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(src);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content size="4xl" className="bg-black/90 border-0 p-0">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black/80"
          aria-label="关闭"
        >
          <X size={20} aria-hidden />
        </button>
        {isVideo ? (
          <video src={src} controls className="max-h-[90vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="max-h-[90vh] w-full object-contain" />
        )}
      </Dialog.Content>
    </Dialog>
  );
}
