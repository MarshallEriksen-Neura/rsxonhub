"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { useSidebarCollapse } from "./sidebar-collapse-context";

export function SidebarToggleButton() {
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-md"
      onClick={toggleCollapsed}
      aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
      aria-pressed={collapsed}
      title={collapsed ? "展开侧边栏" : "收起侧边栏"}
    >
      <Icon size={18} aria-hidden />
    </Button>
  );
}
