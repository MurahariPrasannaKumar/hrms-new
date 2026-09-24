"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      <ul className="space-y-1">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? i.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                  collapsed && "justify-center px-0",
                )}
              >
                <i.icon className="size-5 shrink-0" aria-hidden />
                <span className={cn(collapsed && "sr-only")}>{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
