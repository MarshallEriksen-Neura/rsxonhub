import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 主题 store。CSS 的亮暗已在 app/globals.css 用 .dark 类就绪,
 * 这里只负责状态管理 + 持久化。把 .dark 类同步到 <html> 的副作用
 * 在 ThemeProvider 中处理。
 */
export type Theme = "light" | "dark" | "system";

const THEME_SWITCH_DELAY_MS = 2000;
const THEME_SWITCH_SETTLE_MS = 700;
let themeSwitchTimer: number | undefined;
let themeSettleTimer: number | undefined;

interface ThemeState {
  theme: Theme;
  isThemeTransitioning: boolean;
  pendingTheme: "light" | "dark" | null;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      isThemeTransitioning: false,
      pendingTheme: null,
      setTheme: (theme) => set({ theme }),
      toggle: () => {
        if (get().isThemeTransitioning) return;

        const resolved = resolveTheme(get().theme);
        const pendingTheme = resolved === "dark" ? "light" : "dark";

        window.clearTimeout(themeSwitchTimer);
        window.clearTimeout(themeSettleTimer);
        set({ isThemeTransitioning: true, pendingTheme });

        themeSwitchTimer = window.setTimeout(() => {
          set({ theme: pendingTheme });

          themeSettleTimer = window.setTimeout(() => {
            set({ isThemeTransitioning: false, pendingTheme: null });
          }, THEME_SWITCH_SETTLE_MS);
        }, THEME_SWITCH_DELAY_MS);
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
