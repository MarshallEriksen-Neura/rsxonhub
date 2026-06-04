"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { useSidebarCollapse } from "./sidebar-collapse-context";

/**
 * AppShell sidebar — Notion-editorial collapsible navigation.
 *
 * Design features:
 * - Brand section with refined purple "R" mark + wordmark (hidden mobile)
 * - Purple left-border active indicator with translucent tint background
 * - Bold weight on active label for stronger visual hierarchy
 * - Responsive icon-only (w-16) on mobile → full (w-56) on desktop
 * - Smooth color/bg transitions on all interactive elements
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebarCollapse();

  return (
    <motion.nav
      layout
      className={cn(
        "flex h-full w-16 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar lg:px-3",
        collapsed ? "lg:w-16" : "lg:w-56",
      )}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ── Brand Section ── */}
      <div
        className={cn(
          "flex flex-col items-center px-2 pb-2 pt-4 lg:px-0",
          collapsed ? "lg:items-center" : "lg:items-stretch",
        )}
      >
        <Link
          href="/feed"
          className={cn(
            "mb-4 flex min-w-0 items-center justify-center gap-2.5",
            !collapsed && "lg:justify-start",
          )}
          title="rsxonhub"
        >
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground font-head text-body-md-medium shadow-subtle">
            R
          </span>
          <motion.span
            animate={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : "auto",
            }}
            className="hidden overflow-hidden whitespace-nowrap font-head text-heading-5 font-semibold text-foreground lg:inline-block"
            initial={false}
            transition={{ duration: 0.16 }}
          >
            rsxonhub
          </motion.span>
        </Link>
      </div>

      {/* ── Navigation Items ── */}
      <ul className="flex flex-1 flex-col gap-0.5 px-2 lg:px-0">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={label}
                className={cn(
                  "group relative flex min-w-0 items-center justify-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150",
                  !collapsed && "lg:justify-start lg:px-3",
                  active
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {/* Active indicator — purple left border */}
                {active && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-primary"
                    aria-hidden
                  />
                )}

                {/* Icon */}
                <Icon
                  size={18}
                  aria-hidden
                  className="shrink-0"
                  strokeWidth={active ? 2.2 : 1.8}
                />

                {/* Label */}
                <motion.span
                  animate={{
                    opacity: collapsed ? 0 : 1,
                    width: collapsed ? 0 : "auto",
                  }}
                  className={cn(
                    "hidden overflow-hidden whitespace-nowrap text-body-sm-medium lg:inline-block",
                    active && "font-semibold",
                  )}
                  initial={false}
                  transition={{ duration: 0.16 }}
                >
                  {label}
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
