import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTitle } from "./page-title";
import { SidebarToggleButton } from "./sidebar-toggle-button";
import { UserMenu } from "./user-menu";

/**
 * AppShell top bar — shared command bar for authenticated pages.
 *
 * Two balanced zones over a hairline-divided grid:
 *  - Left:   sidebar toggle + route-derived title (<PageTitle />).
 *  - Right:  theme toggle + user menu, grouped behind a vertical hairline.
 *
 * Stays a Server Component (needs auth()); all motion lives in the
 * isolated client leaves it composes.
 */
export async function AppTopbar() {
  const session = await auth();

  const displayName =
    session?.user?.name ?? session?.user?.email ?? "";
  const initials = displayName
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

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
          <ThemeToggle />
          <span className="hidden h-5 w-px bg-border/70 sm:block" aria-hidden />
          <UserMenu displayName={displayName || "用户"} initials={initials || "U"} />
        </div>
      </div>
    </header>
  );
}
