"use client";

import { cn } from "@/lib/utils";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import React, { ComponentPropsWithoutRef } from "react";

const Menu = BaseMenu.Root;
const Trigger = BaseMenu.Trigger;
const Positioner = BaseMenu.Positioner;

interface IMenuContent extends ComponentPropsWithoutRef<typeof BaseMenu.Popup> {
  align?: ComponentPropsWithoutRef<typeof Positioner>["align"];
  sideOffset?: ComponentPropsWithoutRef<typeof Positioner>["sideOffset"];
}

const Content = ({
  align = "end",
  className,
  sideOffset = 8,
  ...props
}: IMenuContent) => (
  <BaseMenu.Portal>
    <Positioner sideOffset={sideOffset} align={align}>
      <BaseMenu.Popup
        className={cn(
          "z-50 min-w-32 rounded-md border-2 border-black bg-card p-1 shadow-md outline-none",
          className,
        )}
        {...props}
      />
    </Positioner>
  </BaseMenu.Portal>
);

const MenuItem = React.forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseMenu.Item>
>(({ className, ...props }, ref) => (
  <BaseMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-xs px-2 py-1.5 text-sm text-foreground outline-hidden transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
MenuItem.displayName = "MenuItem";

const MenuComponent = Object.assign(Menu, {
  Trigger,
  Positioner,
  Content,
  Item: MenuItem,
});

export { MenuComponent as Menu };
