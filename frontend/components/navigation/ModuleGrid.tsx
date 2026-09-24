"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { navForUser, TINT_CLASSES, type NavItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function ModuleCard({ item, index = 0 }: { item: NavItem; index?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.2 }}>
      <Link
        href={item.href}
        className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("flex size-14 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:-translate-y-0.5 sm:size-16", TINT_CLASSES[item.tint])}>
          <item.icon className="size-6 sm:size-7" aria-hidden />
        </span>
        <span className="text-xs font-medium leading-tight sm:text-sm">{item.label}</span>
      </Link>
    </motion.div>
  );
}

/** Permission- and module-aware launcher: 4 columns on mobile, more on larger screens. */
export function ModuleGrid({ items }: { items?: NavItem[] }) {
  const { user } = useAuth();
  const list = useMemo(() => items ?? (user ? navForUser(user).filter((i) => !i.href.endsWith("/dashboard")) : []), [items, user]);
  if (!list.length) return null;
  return (
    <section aria-label="Modules" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {list.map((i, idx) => (
          <li key={i.href}><ModuleCard item={i} index={idx} /></li>
        ))}
      </ul>
    </section>
  );
}
