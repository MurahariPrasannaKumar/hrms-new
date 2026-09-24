"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Layers } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { QueryBoundary } from "../shared";
import { resourceService } from "@/lib/api/learning-ai";
import { ResourceLibrary } from "./ResourceLibrary";

/** CMDS 2.0 home: summary tiles on top of the searchable content library; cards open a detail page. */
export function CmdsDashboard({ detailBase }: { detailBase: string }) {
  const categories = useQuery({ queryKey: ["resource-categories", "cmds"], queryFn: () => resourceService.categories("cmds") });
  const total = categories.data?.reduce((n, c) => n + c.count, 0) ?? 0;
  return (
    <div className="space-y-6">
      <QueryBoundary loading={false} error={categories.error} moduleName="CMDS 2.0" onRetry={() => categories.refetch()}>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <StatCard label="Content items" value={total} icon={Layers} />
          <StatCard label="Categories" value={categories.data?.length ?? 0} icon={FolderOpen} />
        </div>
      </QueryBoundary>
      <ResourceLibrary area="cmds" detailBase={detailBase} />
    </div>
  );
}
