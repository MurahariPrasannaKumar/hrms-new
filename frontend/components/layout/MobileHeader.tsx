"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { NavList } from "@/components/navigation/NavList";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { UserMenu } from "@/components/navigation/UserMenu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavItem } from "@/lib/permissions";
import { Logo } from "./Logo";

export function MobileHeader({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <Logo />
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu compact />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle><Logo /></SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <NavList items={items} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
