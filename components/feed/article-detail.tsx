"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ExternalLink,
  MessagesSquare,
  FileText,
  AlertCircle,
  Sparkles,
  X,
  Star,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Dialog } from "@/components/retroui/Dialog";
import { type Importance } from "@/lib/mock/feed";
import type { ArticleView } from "@/components/feed/article-list";
import { useFeedStore } from "@/lib/stores/feed";
import { toast } from "sonner";
import { Accordion } from "@/components/retroui/Accordion";
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
  unknown: "default",
};

const importanceLabelMap: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
  unknown: "未评",
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
  const [isFullscreen, setIsFullscreen] = useState(false);
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
          setIsFullscreen(false);
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
          size="icon"
          variant="ghost"
          aria-label="全屏阅读"
          title="全屏阅读"
          onClick={() => setIsFullscreen(true)}
          className="size-9"
        >
          <Maximize2 size={16} aria-hidden />
        </Button>
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
        <AiSummary key={visibleArticle.id} article={visibleArticle} />

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

      <FullscreenArticleReader
        article={visibleArticle}
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        onMediaClick={openLightbox}
      />
    </article>
  );
}

function FullscreenArticleReader({
  article,
  open,
  onClose,
  onMediaClick,
}: {
  article: ArticleView;
  open: boolean;
  onClose: () => void;
  onMediaClick: (src: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const contentTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, stiffness: 220, damping: 28, mass: 0.85 };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex bg-ink-deep/35 p-0 backdrop-blur-sm md:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="全屏阅读"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
        >
          <motion.section
            className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border border-hairline bg-background shadow-2xl md:rounded-lg"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.965, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.975, y: 10 }
            }
            transition={contentTransition}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-background/90 px-4 py-3 backdrop-blur-sm md:px-6">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-steel">
                  {article.feedTitle}
                </p>
                <p className="truncate text-body-sm font-semibold text-charcoal">
                  {article.title}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="退出全屏"
                title="退出全屏"
                onClick={onClose}
                className="size-9 shrink-0"
              >
                <Minimize2 size={16} aria-hidden />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-8 md:px-8 lg:py-10">
                <header className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-steel">
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

                  <h1 className="font-head text-heading-3 font-semibold leading-tight tracking-tight text-ink-deep md:text-heading-2">
                    {article.title}
                  </h1>
                </header>

                {article.imageUrl ? (
                  <MediaLightbox src={article.imageUrl} alt={article.title ?? ""}>
                    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={article.imageUrl}
                        alt={article.title ?? ""}
                        className="block w-full cursor-zoom-in object-cover transition-opacity hover:opacity-90"
                      />
                    </div>
                  </MediaLightbox>
                ) : null}

                <ArticleContent html={article.content} onMediaClick={onMediaClick} />
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

type SummaryData = { summary: string; bullets: string[]; tags: string[]; importance: number };
const SUMMARY_REQUEST_TIMEOUT_MS = 90_000;

/**
 * AI 摘要。
 * 展开时若已有摘要直接显示，否则请求后端生成。
 * 未配置 AI 时 toast 提示。
 */
function AiSummary({ article }: { article: ArticleView }) {
  const [data, setData] = useState<SummaryData | null>(
    summaryDataFromArticle(article),
  );
  const [error, setError] = useState<string | null>(
    article.summaryStatus === "failed" ? article.summaryError ?? "摘要生成失败" : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleOpen(open: boolean) {
    if (!open || data || loading) return;

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUMMARY_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/articles/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ articleId: article.id }),
      });
      const payload = await res.json();

      if (!res.ok) {
        if (payload.error === "AI_NOT_CONFIGURED") {
          toast.warning("未配置 AI，请前往设置填写 API Key。");
        } else {
          toast.error(payload.message ?? "摘要生成失败");
        }
        setError(payload.message ?? "摘要生成失败");
        return;
      }

      if (payload.summary) {
        setData(payload.summary);
      } else {
        setError("摘要生成没有返回内容，请重试。");
      }
    } catch (requestError) {
      const message =
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "摘要生成超时，请稍后重试。"
          : "网络错误，摘要加载失败";
      setError(message);
      toast.error(message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <Accordion
      className="rounded-lg border-l-4 border-primary bg-primary/5 shadow-none"
      onValueChange={(openItems) => void handleOpen((openItems as string[]).includes("ai-summary"))}
    >
      <Accordion.Item value="ai-summary" className="border-0 shadow-none bg-transparent">
        <Accordion.Header className="gap-2 px-5 py-4 hover:bg-primary/10 focus-visible:ring-primary/40">
          <Sparkles size={16} className={cn("text-primary", loading && "animate-pulse")} aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider text-steel">
            AI 摘要
          </span>
          {!data && !loading && (
            <span className="text-caption text-stone">{error ? "失败" : "暂无"}</span>
          )}
        </Accordion.Header>
        <Accordion.Content className="flex flex-col gap-4 px-5 pb-5 pt-0">
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : data ? (
            <>
              <p className="text-body-md leading-relaxed text-charcoal">{data.summary}</p>
              {data.bullets.length > 0 && (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm leading-relaxed text-slate">
                  {data.bullets.map((b, i) => (
                    <li key={i} className="marker:text-primary">{b}</li>
                  ))}
                </ul>
              )}
            </>
          ) : error ? (
            <div className="flex flex-col gap-3 text-body-sm leading-relaxed text-stone">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                <span className="min-w-0 whitespace-pre-wrap break-words">{error}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpen(true)}
                className="w-fit"
              >
                重新生成
              </Button>
            </div>
          ) : (
            <p className="text-body-sm leading-relaxed text-stone">暂无 AI 摘要。</p>
          )}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

function summaryDataFromArticle(article: ArticleView): SummaryData | null {
  return article.summary.trim()
    ? {
        summary: article.summary,
        bullets: article.bullets,
        tags: article.tags,
        importance: 0,
      }
    : null;
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
