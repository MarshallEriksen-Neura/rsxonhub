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
}: {
  html: string | null | undefined;
  className?: string;
}) {
  if (typeof html !== "string" || html.trim().length === 0) {
    return (
      <p className="text-body-md leading-relaxed text-steel">
        这篇文章没有正文内容,点击右上角「原文」查看来源页面。
      </p>
    );
  }

  return (
    <div
      className={cn("prose-article text-body-md text-charcoal", className)}
      // html 已在 ingest 阶段净化(见组件顶部安全约定)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
