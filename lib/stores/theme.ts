import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 主题 store。CSS 的亮暗已在 app/globals.css 用 .dark 类就绪,
 * 这里只负责状态管理 + 持久化。把 .dark 类同步到 <html> 的副作用
 * 在 ThemeProvider 中处理。
 */
export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      toggle: () => {
        const resolved = resolveTheme(get().theme);
        set({ theme: resolved === "dark" ? "light" : "dark" });
      },
    }),
    {
      name: "rsxonhub-theme",
    },
  ),
);

/** 把 system 解析成实际的 light/dark。 */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}
