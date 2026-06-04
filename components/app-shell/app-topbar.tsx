import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTitle } from "./page-title";

/**
 * AppShell top bar — Refined Notion-editorial header.
 *
 * Design features:
 * - Signature 2px purple accent line (brand identity, echoes the purple CTA)
 * - Strong page title with responsive typography (heading-5 → heading-4 on desktop)
 * - Purple avatar circle with user initials (brand-consistent identity mark)
 * - Staggered fade-in entrance animation (subtle polish, no layout shift)
 * - Responsive padding and spacing for mobile through desktop
 *
 * Title is derived from the current route by <PageTitle />.
 * Right side is fixed: identity + sign-out + theme toggle.
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
      {/* Signature brand accent — a thin purple line that ties every page
          to the product's primary CTA color. Solid, not gradient. */}
      <div className="h-[2px] w-full bg-primary" aria-hidden />

      <div className="flex h-14 items-center justify-between border-b border-border/60 bg-card px-4 lg:h-[60px] lg:px-6">
        {/* ── Page Title ── */}
        <PageTitle />

        {/* ── Right: Identity + Actions ── */}
        <div className="flex items-center gap-3 lg:gap-4">
          {/* User identity cluster */}
          <div className="flex items-center gap-2.5 animate-in fade-in duration-300 delay-75">
            {displayName && (
              <span className="hidden text-body-sm-medium text-muted-foreground sm:inline">
                {displayName}
              </span>
            )}
            {initials && (
              <div
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-micro font-semibold text-primary-foreground shadow-subtle"
                aria-label={displayName || "用户"}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Action buttons — the SignOutButton form + ThemeToggle client component
              each render their own Button with retro shadow/translate styles.
              We group them with consistent gap spacing. */}
          <div className="flex items-center gap-1.5 animate-in fade-in duration-300 delay-150">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
