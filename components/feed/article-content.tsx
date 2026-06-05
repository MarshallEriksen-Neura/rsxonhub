"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * 文章正文渲染器。
 *
 * 安全约定: `html` 必须是「已净化」的 HTML —— 真实 RSS 内容在 ingest 阶段
 * 经 lib/rss/sanitize.ts 净化后入库,mock 数据为手写可信内容。此组件不再二次净化,
 * 只负责排版与图片/视频的响应式呈现。切勿把未净化的外部 HTML 直接传进来。
 *
 * 排版与媒体样式由 globals.css 的 .prose-article 提供(图片/视频自适应、iframe 16:9 等)。
 */
export function ArticleContent({
  html,
  className,
  onMediaClick,
}: {
  html: string | null | undefined;
  className?: string;
  onMediaClick?: (src: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !onMediaClick) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        const src = (target as HTMLImageElement).src;
        if (src) onMediaClick(src);
      } else if (target.tagName === "VIDEO") {
        const src = (target as HTMLVideoElement).currentSrc || (target as HTMLVideoElement).src;
        if (src) onMediaClick(src);
      }
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [onMediaClick]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const media = Array.from(
      root.querySelectorAll<HTMLImageElement | HTMLVideoElement | HTMLIFrameElement>(
        "img, video, iframe",
      ),
    );
    const cleanups: Array<() => void> = [];

    for (const element of media) {
      const isLoaded =
        (element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0) ||
        (element instanceof HTMLVideoElement && element.readyState >= 2);

      if (isLoaded) continue;

      element.classList.add("article-media-loading");
      element.setAttribute("data-media-loading", "true");

      const markLoaded = () => {
        element.classList.remove("article-media-loading");
        element.removeAttribute("data-media-loading");
      };

      element.addEventListener("load", markLoaded, { once: true });
      element.addEventListener("loadeddata", markLoaded, { once: true });
      element.addEventListener("error", markLoaded, { once: true });
      cleanups.push(() => {
        element.removeEventListener("load", markLoaded);
        element.removeEventListener("loadeddata", markLoaded);
        element.removeEventListener("error", markLoaded);
        markLoaded();
      });
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [html]);

  if (typeof html !== "string" || html.trim().length === 0) {
    return (
      <p className="text-body-md leading-relaxed text-steel">
        这篇文章没有正文内容,点击右上角「原文」查看来源页面。
      </p>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "prose-article text-body-md text-charcoal [&_img]:cursor-zoom-in [&_video]:cursor-pointer",
        className,
      )}
      // html 已在 ingest 阶段净化(见组件顶部安全约定)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
