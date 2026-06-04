"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/retroui/Button";
import { resolveTheme, useThemeStore } from "@/lib/stores/theme";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * 主题切换按钮。复用 RetroUI Button(见 CLAUDE.md UI 约定)。
 * 在 light/dark 间切换;系统模式由 store 解析后翻转。
 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isThemeTransitioning = useThemeStore((s) => s.isThemeTransitioning);
  const canResolveClientTheme = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const isDark = canResolveClientTheme ? resolveTheme(theme) === "dark" : false;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      disabled={isThemeTransitioning}
      aria-label={isDark ? "切换到亮色" : "切换到暗色"}
      aria-busy={isThemeTransitioning}
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  );
}
