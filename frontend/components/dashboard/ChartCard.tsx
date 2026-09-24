"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  title: string;
  description?: string;
  loading?: boolean;
  height?: number;
  action?: ReactNode;
  /** A single Recharts chart element (LineChart, BarChart, ...). */
  children: React.ReactElement;
}

export function ChartCard({ title, description, loading, height = 260, action, children }: Props) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label={title}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {loading ? (
        <Skeleton style={{ height }} className="w-full rounded-xl" />
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
