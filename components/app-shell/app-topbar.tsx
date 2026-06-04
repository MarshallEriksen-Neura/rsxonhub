import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTitle } from "./page-title";
import { SidebarToggleButton } from "./sidebar-toggle-button";
import { UserMenu } from "./user-menu";

/**
 * AppShell top bar — shared header for authenticated pages.
 *
 * Title is derived from the current route by <PageTitle />.
 * Right side is fixed: theme toggle + user menu.
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
    <header>
      <div className="h-[2px] w-full bg-primary" aria-hidden />

      <div className="flex h-14 items-center justify-between border-b border-border/60 bg-card px-4 lg:h-[60px] lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <SidebarToggleButton />
          <PageTitle />
        </div>

        <div className="flex items-center gap-2.5 animate-in fade-in duration-300 delay-150">
          <ThemeToggle />
          <UserMenu displayName={displayName || "用户"} initials={initials || "U"} />
        </div>
      </div>
    </header>
  );
}
