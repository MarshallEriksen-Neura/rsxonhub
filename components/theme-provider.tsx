"use client";

import { useEffect } from "react";
import { resolveTheme, useThemeStore } from "@/lib/stores/theme";

/**
 * 把主题 store 的状态同步到 <html> 的 .dark 类。
 * 监听 system 主题变化(仅当用户选 system 时跟随)。
 * 防闪烁由 layout 中的内联脚本处理(见 ThemeScript)。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

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

  return <>{children}</>;
}

/**
 * 防 FOUC 内联脚本:在 React 注水前就根据 localStorage / system 设好 .dark。
 * 放在 <head>,用 dangerouslySetInnerHTML 注入。
 */
export function ThemeScript() {
  const code = `(function(){try{var s=localStorage.getItem('rsxonhub-theme');var t=s?JSON.parse(s).state.theme:'system';var d=t==='dark'||((t==='system'||!t)&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
