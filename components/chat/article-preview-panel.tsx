"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Drawer } from "@/components/retroui/Drawer";
import { useChatStore } from "@/lib/stores/chat";

type ArticlePreview = {
  id: number;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  feedTitle: string | null;
  summary: string | null;
  bullets: string[] | null;
  tags: string[] | null;
};

export function ArticlePreviewPanel() {
  const { previewArticleId, setPreviewArticleId } = useChatStore();
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!previewArticleId) {
      const timer = window.setTimeout(() => setArticle(null), 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/articles/${previewArticleId}/preview`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setArticle(data as ArticlePreview);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewArticleId]);

  return (
    <Drawer
      open={!!previewArticleId}
      onOpenChange={(open) => { if (!open) setPreviewArticleId(null); }}
    >
      <Drawer.Content side="right" className="sm:max-w-md flex flex-col gap-0">
        <Drawer.Header className="flex-row items-start justify-between border-b border-hairline pb-3">
          <div className="min-w-0 flex-1">
            <Drawer.Title className="text-base line-clamp-2">
              {loading ? "加载中…" : (article?.title ?? "文章预览")}
            </Drawer.Title>
            {article?.feedTitle && (
              <Drawer.Description className="mt-0.5 truncate text-xs">
                {article.feedTitle}
                {article.publishedAt && (
                  <> · {new Date(article.publishedAt).toLocaleDateString("zh-CN")}</>
                )}
              </Drawer.Description>
            )}
          </div>
          <Drawer.Close className="ml-2 mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-surface hover:text-ink transition-colors">
            <X size={16} />
          </Drawer.Close>
        </Drawer.Header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              加载中…
            </div>
          )}

          {!loading && article && (
            <>
              {article.summary && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">摘要</h3>
                  <p className="text-sm leading-relaxed text-charcoal">{article.summary}</p>
                </section>
              )}

              {article.bullets && article.bullets.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">要点</h3>
                  <ul className="space-y-1.5">
                    {article.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2 text-sm text-charcoal">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {article.tags && article.tags.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">标签</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {article.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-surface px-2 py-0.5 text-xs text-steel">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {article?.url && (
          <Drawer.Footer className="border-t border-hairline pt-3">
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
            >
              <ExternalLink size={14} />
              阅读原文
            </a>
          </Drawer.Footer>
        )}
      </Drawer.Content>
    </Drawer>
  );
}
