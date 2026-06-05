import { auth } from "@/auth";
import { AppSidebarClient } from "./app-sidebar-client";

/**
 * Server wrapper for the interactive sidebar.
 *
 * Auth and database-backed session lookup must stay on the server; the client
 * leaf receives only serializable display props so postgres never enters the
 * browser bundle.
 */
export async function AppSidebar() {
  const session = await auth();
  const displayName = session?.user?.name ?? session?.user?.email ?? "";
  const initials = displayName
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <AppSidebarClient
      displayName={displayName || "用户"}
      initials={initials || "U"}
    />
  );
}
