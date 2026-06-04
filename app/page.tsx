import { redirect } from "next/navigation";

/**
 * 首页(根路由)。单用户阅读器没有独立着陆页,
 * 直接进入 (app) 外壳的主阅读界面 /feed(共享 header + 侧边栏)。
 * 未认证时由 proxy.ts(middleware)拦截到 /login。
 */
export default function HomePage() {
  redirect("/feed");
}
