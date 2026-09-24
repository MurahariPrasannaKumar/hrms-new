"use client";

import { Construction } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "./PageHeader";

const titleCase = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ComingSoon({ title }: { title?: string }) {
  const params = useParams<{ slug?: string[] }>();
  const name = title ?? titleCase((params.slug ?? []).join(" / ") || "Module");
  return (
    <div>
      <PageHeader title={name} />
      <div className="rounded-2xl border bg-card shadow-sm">
        <EmptyState title="This module is being built" description="It will appear here in an upcoming release." action={<Construction className="size-5 text-muted-foreground" aria-hidden />} />
      </div>
    </div>
  );
}
