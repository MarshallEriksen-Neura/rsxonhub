import {
  CircleAlert,
  ListChecks,
  MessagesSquare,
  Rss,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * 主导航单一数据源。侧边栏、顶栏标题、面包屑都从这里取,
 * 保证路由与文案永远一致(改一处即可)。
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/feed", label: "订阅", icon: Rss },
  { href: "/digest", label: "每日精选", icon: Sparkles },
  { href: "/chat", label: "AI 问答", icon: MessagesSquare },
  { href: "/jobs", label: "队列状态", icon: ListChecks },
  { href: "/logs", label: "错误日志", icon: CircleAlert },
  { href: "/settings", label: "设置", icon: Settings },
] as const;

/** 由 pathname 推导当前页文案;命中最长前缀,无命中回退到产品名。 */
export function routeLabel(pathname: string): string {
  const hit = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return hit?.label ?? "rsxonhub";
}
