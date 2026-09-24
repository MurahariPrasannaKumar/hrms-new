"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const titleCase = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const isId = (s: string) => /^[0-9a-f-]{8,}$/i.test(s);

export function Breadcrumb() {
  const segments = usePathname().split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: isId(seg) ? "Details" : titleCase(seg),
    href: `/${segments.slice(0, i + 1).join("/")}`,
  }));
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-medium text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
