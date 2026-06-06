import { auth } from "@/auth";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTitle } from "./page-title";
import { SidebarToggleButton } from "./sidebar-toggle-button";

/**
 * AppShell top bar — shared command bar for authenticated pages.
 *
 * Two balanced zones over a hairline-divided grid:
 *  - Left:   sidebar toggle + route-derived title (<PageTitle />).
 *  - Right:  theme toggle, grouped behind a vertical hairline.
 *
 * Stays a Server Component (needs auth()); all motion lives in the
 * isolated client leaves it composes.
 */
export async function AppTopbar() {
  return (
    <header className="sticky top-0 z-20 bg-card/85 backdrop-blur-md backdrop-saturate-150">
      {/* Accent hairline — fades from primary into transparent, not a full bar */}
      <div
        className="h-px w-full bg-gradient-to-r from-primary via-primary/30 to-transparent"
        aria-hidden
      />

      <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/60 px-3 lg:h-[60px] lg:gap-4 lg:px-5">
        {/* ── Left: toggle + title ─ */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <SidebarToggleButton />
          <span className="hidden h-5 w-px bg-border/70 sm:block" aria-hidden />
          <PageTitle />
        </div>

        {/* ── Center: empty spacer ── */}
        <div className="flex min-w-0 justify-center px-1 max-sm:hidden" />

        {/* ── Right: utilities ─ */}
        <div className="flex items-center gap-2 animate-in fade-in duration-300 delay-150 sm:gap-2.5">
          <Link
            href="https://github.com/MarshallEriksen-Neura/rsxonhub"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
