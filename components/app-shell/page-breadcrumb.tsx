"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import { routeLabel } from "./nav";

/**
 * PageBreadcrumb — lightweight editorial breadcrumb trail.
 *
 * Sits between AppTopbar and page content. Derives the current page name
 * from the route (no per-page props), with a small home icon root link,
 * chevron separators, and the current page as non-linked muted text.
 *
 * Design: minimal, muted typography that doesn't compete with the
 * page title or main content. Responsive padding matches page gutters.
 */
export function PageBreadcrumb() {
  const pathname = usePathname();
  const label = routeLabel(pathname);

  return (
    <nav
      aria-label="面包屑"
      className="flex items-center gap-1.5 px-4 py-2 lg:px-6"
    >
      <Link
        href="/feed"
        className="grid size-5 shrink-0 place-items-center rounded-sm text-stone transition-colors hover:text-foreground"
        aria-label="首页"
      >
        <Home size={14} />
      </Link>

      <span className="flex items-center gap-1.5">
        <ChevronRight size={12} className="shrink-0 text-stone" aria-hidden />
        <span className="text-caption text-muted-foreground">{label}</span>
      </span>
    </nav>
  );
}
