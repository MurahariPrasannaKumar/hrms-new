"use client";

import { useMemo, type ReactNode } from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { UsageTrackerProvider } from "@/components/usage/UsageTracker";
import { useAuth } from "@/lib/auth";
import { navForUser } from "@/lib/permissions";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const items = useMemo(() => (user ? navForUser(user) : []), [user]);

  return (
    <UsageTrackerProvider>
    <div className="flex min-h-screen bg-muted/30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader items={items} />
        <Topbar />
        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav items={items} />
    </div>
    </UsageTrackerProvider>
  );
}
