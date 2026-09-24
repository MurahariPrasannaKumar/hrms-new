"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NavList } from "@/components/navigation/NavList";
import type { NavItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

export function Sidebar({ items }: { items: NavItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b px-4", collapsed && "justify-center px-0")}>
        <Logo showText={!collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavList items={items} collapsed={collapsed} />
      </div>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start gap-2", collapsed && "justify-center")}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
