import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { LoginVisual } from "@/components/auth/login-visual";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/**
 * 全页登录 — Notion 编辑风高级感分屏(premium split-screen)。
 *
 * 左:品牌/视觉面板(LoginVisual)— 生成图作底,渐变 scrim + 颗粒 + 价值列表。
 * 右:表单卡 — 大留白居中,复用 LoginForm,主题切换在右上角。
 *
 * 冷启动未认证时由 proxy.ts rewrite 到此(地址栏停在原路径);
 * 站内软导航到 /login 则由 @modal 拦截成 Dialog,不走这里。
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { callbackUrl } = await searchParams;

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* ── 左:视觉面板(桌面端) ── */}
      <LoginVisual />

      {/* ── 右:表单区 ── */}
      <main className="relative flex min-h-dvh flex-col">
        {/* 顶部紫色签名线,呼应 app shell 顶栏 */}
        <div className="h-[3px] w-full bg-primary" aria-hidden />

        {/* 右上:主题切换 */}
        <div className="absolute right-5 top-6 z-10 lg:right-8">
          <ThemeToggle />
        </div>

        {/* 移动端品牌条(桌面端由左面板承担) */}
        <div className="flex items-center gap-2.5 px-6 pt-6 lg:hidden">
          <span className="grid size-9 place-items-center rounded-md bg-primary font-head text-body-md-medium text-primary-foreground shadow-subtle">
            R
          </span>
          <span className="font-head text-heading-5 font-semibold">
            rsxonhub
          </span>
        </div>

        {/* 表单卡居中 */}
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="flex w-full max-w-[26rem] flex-col gap-9">
            <header className="flex flex-col gap-3 duration-500 animate-in fade-in slide-in-from-bottom-2">
              <p className="badge-tag-purple w-fit">单用户 · 私有访问</p>
              <h1 className="font-head text-heading-2 font-semibold tracking-tight">
                欢迎回来
              </h1>
              <p className="text-body-md text-muted-foreground">
                登录进入你的 AI 阅读工作台 — 摘要、每日精选与全库问答。
              </p>
            </header>

            <div className="duration-500 animate-in fade-in slide-in-from-bottom-3 [animation-delay:90ms]">
              <LoginForm callbackUrl={callbackUrl || "/"} />
            </div>

            <p className="text-caption text-stone duration-500 animate-in fade-in [animation-delay:180ms]">
              访问受 proxy 中间件保护 · 内容不对外公开
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
