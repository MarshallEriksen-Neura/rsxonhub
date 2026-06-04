"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/retroui/Button";
import { resolveTheme, useThemeStore } from "@/lib/stores/theme";

/**
 * 主题切换按钮。复用 RetroUI Button(见 CLAUDE.md UI 约定)。
 * 在 light/dark 间切换;系统模式由 store 解析后翻转。
 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = resolveTheme(theme) === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "切换到亮色" : "切换到暗色"}
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  );
}
