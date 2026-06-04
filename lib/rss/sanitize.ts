import sanitizeHtml from "sanitize-html";

/**
 * RSS 正文是不可信的外部 HTML —— 渲染前必须净化，否则 dangerouslySetInnerHTML 会带来 XSS。
 * 在 ingest 阶段净化并存「干净 HTML」，前端只渲染已净化内容。
 *
 * 放行范围:
 * - 文本/排版结构(默认白名单)
 * - 图片: img / picture / figure / figcaption
 * - 视频/音频: video / audio / source
 * - 站外嵌入视频: iframe，但仅限白名单 host(YouTube/Bilibili/Vimeo)
 */

// 仅放行可信的视频嵌入站点，杜绝任意 iframe 注入。
const ALLOWED_IFRAME_HOSTNAMES = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.bilibili.com",
  "player.vimeo.com",
  "www.dailymotion.com",
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "picture",
    "source",
    "figure",
    "figcaption",
    "video",
    "audio",
    "iframe",
    "h1",
    "h2",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading"],
    source: ["src", "srcset", "type", "media", "sizes"],
    video: ["src", "poster", "width", "height", "controls", "preload", "playsinline"],
    audio: ["src", "controls", "preload"],
    iframe: [
      "src",
      "width",
      "height",
      "allow",
      "allowfullscreen",
      "frameborder",
      "title",
      "loading",
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // 图片额外放行 data: URI(内联图)，但其他标签不允许，避免 data:text/html 注入。
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
  // 协议相对地址(//host/...)按 https 处理。
  allowProtocolRelative: true,
  transformTags: {
    // 站外链接统一新开页并断开 opener，防 reverse-tabnabbing。
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
    // 图片懒加载,避免长文一次性拉满网络。
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: attribs.loading ?? "lazy" },
    }),
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: attribs.loading ?? "lazy" },
    }),
  },
};

/**
 * 净化文章正文 HTML。空内容返回 null,净化后为空白同样返回 null。
 */
export function sanitizeArticleHtml(dirty: string | null | undefined): string | null {
  if (typeof dirty !== "string" || dirty.trim().length === 0) {
    return null;
  }

  const clean = sanitizeHtml(dirty, SANITIZE_OPTIONS).trim();
  return clean.length > 0 ? clean : null;
}
