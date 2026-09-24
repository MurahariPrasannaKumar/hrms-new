import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { TINT_CLASSES, type Tint } from "@/lib/permissions/nav";
import { cn } from "@/lib/utils";

export function QuickAction({ label, href, icon: Icon, tint = "indigo" }: { label: string; href: string; icon: LucideIcon; tint?: Tint }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("flex size-9 items-center justify-center rounded-xl", TINT_CLASSES[tint])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
