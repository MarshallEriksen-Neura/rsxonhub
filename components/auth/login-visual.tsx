import { Rss, Sparkles, MessagesSquare } from "lucide-react";

/**
 * 登录页左侧视觉面板(桌面 lg+ 显示)。
 *
 * 分层合成(从底到顶):
 *  1. 海军蓝底色(深色模式品牌色),保证无图时不塌陷
 *  2. 生成图 /login-visual.webp 作底(object-cover),没就位则透明,降级到渐变
 *  3. 渐变 scrim:海军蓝 → 紫,从底部压暗,确保白字可读
 *  4. 颗粒噪点(SVG data-uri),消解大色块的廉价感
 *  5. 内容:品牌标识 + slogan + 三条产品价值
 *
 * 把图放到 public/login-visual.webp 即可自动生效;无图时面板依旧成立。
 */
const VALUES = [
  { icon: Rss, title: "聚合订阅", desc: "所有 RSS 源,一处统读" },
  { icon: Sparkles, title: "AI 摘要 · 每日精选", desc: "自动摘要、打分、成简报" },
  { icon: MessagesSquare, title: "全库问答", desc: "带来源引用的 RAG 检索" },
] as const;

export function LoginVisual() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-navy-deep lg:block">
      {/* 1+2. 生成图作底(无图时透明,露出底色/渐变) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login-visual.png')" }}
        aria-hidden
      />

      {/* 3. 渐变 scrim:左上紫晕 + 底部海军蓝压暗 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 15% 10%, rgba(123,63,242,0.55) 0%, rgba(123,63,242,0) 55%), linear-gradient(195deg, rgba(10,21,48,0.35) 0%, rgba(7,15,36,0.92) 78%)",
        }}
        aria-hidden
      />

      {/* 4. 颗粒噪点 */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      {/* 5. 内容层 */}
      <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
        {/* 品牌标识 */}
        <div className="flex items-center gap-3 duration-700 animate-in fade-in slide-in-from-top-2">
          <span className="grid size-10 place-items-center rounded-lg bg-white/95 font-head text-heading-5 font-semibold text-primary shadow-card">
            R
          </span>
          <span className="font-head text-heading-5 font-semibold tracking-tight text-white">
            rsxonhub
          </span>
        </div>

        {/* 主标语 + 价值列表 */}
        <div className="flex flex-col gap-10">
          <h2 className="max-w-md font-head text-display-lg font-semibold leading-[1.05] tracking-tight text-white duration-700 animate-in fade-in slide-in-from-bottom-3">
            读得更少,
            <br />
            <span className="text-brand-purple-300">懂得更多。</span>
          </h2>

          <ul className="flex flex-col gap-5">
            {VALUES.map(({ icon: Icon, title, desc }, i) => (
              <li
                key={title}
                className="flex items-start gap-4 duration-700 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${150 + i * 110}ms` }}
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border border-white/15 bg-white/10 backdrop-blur-sm">
                  <Icon size={17} className="text-brand-purple-300" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-body-md-medium text-white">{title}</span>
                  <span className="text-body-sm text-white/60">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 页脚签名 */}
        <p className="text-caption text-white/45 duration-700 animate-in fade-in [animation-delay:600ms]">
          AI 增强的 RSS 阅读器 · 单用户私有部署
        </p>
      </div>
    </aside>
  );
}
