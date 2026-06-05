"use client";

import { useEffect } from "react";
import { Loader } from "@/components/retroui/Loader";
import { resolveTheme, useThemeStore } from "@/lib/stores/theme";

/**
 * 把主题 store 的状态同步到 <html> 的 .dark 类。
 * 监听 system 主题变化(仅当用户选 system 时跟随)。
 * 防闪烁由 layout 中的内联脚本处理(见 ThemeScript)。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const isThemeTransitioning = useThemeStore((s) => s.isThemeTransitioning);
  const pendingTheme = useThemeStore((s) => s.pendingTheme);

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    apply();

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return (
    <>
      {children}
      <ThemeTransitionOverlay
        isVisible={isThemeTransitioning}
        pendingTheme={pendingTheme}
      />
    </>
  );
}

function ThemeTransitionOverlay({
  isVisible,
  pendingTheme,
}: {
  isVisible: boolean;
  pendingTheme: "light" | "dark" | null;
}) {
  if (!isVisible) return null;

  return (
    <div
      className="theme-transition-overlay"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="theme-transition-card">
        <Loader size="lg" count={5} duration={0.7} delayStep={85} />
        <span className="theme-transition-label">
          {pendingTheme === "dark" ? "切换到暗色模式" : "切换到亮色模式"}
        </span>
      </div>
    </div>
  );
}
