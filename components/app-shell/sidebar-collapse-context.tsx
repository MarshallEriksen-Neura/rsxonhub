"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SidebarCollapseContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarCollapseContext =
  createContext<SidebarCollapseContextValue | null>(null);

export function SidebarCollapseProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);
  const value = useMemo(
    () => ({ collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed],
  );

  return (
    <SidebarCollapseContext.Provider value={value}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  const context = useContext(SidebarCollapseContext);

  if (!context) {
    throw new Error(
      "useSidebarCollapse must be used within SidebarCollapseProvider",
    );
  }

  return context;
}
