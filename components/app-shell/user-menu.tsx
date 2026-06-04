"use client";

import { AnimatePresence, motion } from "motion/react";
import { LogOut } from "lucide-react";
import { useRef, useState } from "react";
import { signOutToLogin } from "@/components/app-shell/actions";
import { Avatar } from "@/components/retroui/Avatar";
import { Button } from "@/components/retroui/Button";
import { Menu } from "@/components/retroui/Menu";

interface UserMenuProps {
  displayName: string;
  initials: string;
}

type MenuActions = {
  close: () => void;
  unmount: () => void;
};

export function UserMenu({ displayName, initials }: UserMenuProps) {
  const actionsRef = useRef<MenuActions | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <Menu
      actionsRef={actionsRef}
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) {
          eventDetails.preventUnmountOnClose();
        }
        setOpen(nextOpen);
      }}
    >
      <Menu.Trigger
        className="group grid size-9 shrink-0 place-items-center rounded-full outline-none transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[popup-open]:translate-y-0.5"
        aria-label={`${displayName} 菜单`}
      >
        <Avatar className="size-9 border-black shadow-subtle transition-transform duration-200 group-hover:-translate-y-0.5">
          <Avatar.Fallback className="text-caption-bold">
            {initials}
          </Avatar.Fallback>
        </Avatar>
      </Menu.Trigger>

      <AnimatePresence>
        {open && (
          <Menu.Content
            render={
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={() => {
                  if (!open) actionsRef.current?.unmount();
                }}
              />
            }
            className="min-w-44 p-1.5 text-card-foreground dark:bg-card"
          >
            <div className="px-2 py-1.5 text-body-sm-medium text-muted-foreground">
              {displayName}
            </div>
            <Menu.Item
              className="rounded-sm p-0 text-foreground hover:bg-secondary focus:bg-secondary"
              onClick={() => actionsRef.current?.close()}
            >
              <form action={signOutToLogin} className="w-full">
                <Button
                  type="submit"
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2 py-1.5 text-body-sm-medium"
                >
                  <LogOut aria-hidden="true" size={16} />
                  退出
                </Button>
              </form>
            </Menu.Item>
          </Menu.Content>
        )}
      </AnimatePresence>
    </Menu>
  );
}
