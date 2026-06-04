"use client";

import { usePathname } from "next/navigation";
import { routeLabel } from "./nav";

/**
 * 顶栏标题 — 客户端从 pathname 推导当前页文案。
 * 抽成独立组件,让 AppTopbar 保持服务端(需 auth())而标题随路由变化。
 */
export function PageTitle() {
  const pathname = usePathname();
  return (
    <h1 className="font-head text-heading-5 font-semibold tracking-tight text-foreground animate-in fade-in duration-300 lg:text-heading-4">
      {routeLabel(pathname)}
    </h1>
  );
}
