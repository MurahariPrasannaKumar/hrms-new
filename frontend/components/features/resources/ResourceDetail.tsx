"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resourceService } from "@/lib/api/learning-ai";
import { formatDate, QueryBoundary } from "../shared";
import { openResource } from "./ResourceLibrary";

export function ResourceDetail({ id, backHref, moduleName }: { id: string; backHref: string; moduleName: string }) {
  const query = useQuery({ queryKey: ["resource", id], queryFn: () => resourceService.get(id) });
  const r = query.data;
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" render={<Link href={backHref} />}><ArrowLeft className="size-4" aria-hidden /> Back</Button>
      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} moduleName={moduleName}>
        {r && (
          <>
            <PageHeader title={r.title} description={`Added ${formatDate(r.createdAt)}`} />
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">{r.type.replace("_", " ").toLowerCase()}</Badge>
                  {r.category && <Badge variant="outline">{r.category}</Badge>}
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.description ?? "No description provided."}</p>
                <Button disabled={!r.url && !r.fileId} onClick={() => openResource(r)}><ExternalLink className="size-4" aria-hidden /> Open content</Button>
              </CardContent>
            </Card>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
