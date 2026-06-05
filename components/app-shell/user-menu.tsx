"use client";

import { LogOut } from "lucide-react";
import { signOutToLogin } from "@/components/app-shell/actions";
import { Avatar } from "@/components/retroui/Avatar";
import { Button } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  displayName: string;
  initials: string;
  collapsed?: boolean;
}

export function UserMenu({ displayName, initials, collapsed }: UserMenuProps) {
  return (
    <div className="flex w-full items-center gap-2 px-2 py-2">
      <Avatar className="size-8 shrink-0 border border-black/10 shadow-subtle">
        <Avatar.Fallback className="text-caption-bold">
          {initials}
        </Avatar.Fallback>
      </Avatar>

      {!collapsed && (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-sm-medium text-foreground">
              {displayName}
            </span>
            <span className="truncate text-caption text-muted-foreground">
              {displayName}
            </span>
          </div>
          <form action={signOutToLogin}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              title="退出登录"
            >
              <LogOut size={16} />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
