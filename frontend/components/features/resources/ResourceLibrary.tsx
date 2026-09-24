"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Lightbulb, MonitorPlay, Presentation, Puzzle, Trash2, Video, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FilterBar } from "@/components/forms/FilterBar";
import { FormModal } from "@/components/forms/FormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { toApiError } from "@/lib/api/client";
import { fileService, resourceService, type ResourceArea, type ResourceRow, type ResourceType } from "@/lib/api/learning-ai";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate, QueryBoundary, useCan } from "../shared";
import { ResourceForm } from "./ResourceForm";

export const TYPE_ICON: Record<ResourceType, LucideIcon> = {
  VIDEO: Video, PRESENTATION: Presentation, DOCUMENT: FileText, INTERACTIVE: Puzzle, LESSON_PLAN: Lightbulb, OTHER: MonitorPlay,
};

export const AREA_COPY: Record<ResourceArea, { title: string; description: string; module: string; moduleKey: string }> = {
  "smart-class": { title: "Smart Class", description: "Videos, presentations and interactive lessons by subject.", module: "Smart Class", moduleKey: "smart-class" },
  pedagogy: { title: "Pedagogy", description: "Lesson plans, teaching strategies and classroom activities.", module: "Pedagogy", moduleKey: "pedagogy" },
  cmds: { title: "CMDS 2.0", description: "Curriculum and content management library.", module: "CMDS 2.0", moduleKey: "cmds" },
};

export function openResource(r: ResourceRow) {
  if (r.url) window.open(r.url, "_blank", "noopener");
  else if (r.fileId) fileService.open(r.fileId).catch((e) => toast.error(toApiError(e).message));
}

interface Props {
  area: ResourceArea;
  /** When set, cards link to `${detailBase}/${id}` (CMDS detail page) instead of opening directly. */
  detailBase?: string;
}

export function ResourceLibrary({ area, detailBase }: Props) {
  const copy = AREA_COPY[area];
  const can = useCan();
  const canManage = can("learning.manage");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ResourceRow | null>(null);
  const debounced = useDebouncedValue(search, 300);

  const categories = useQuery({ queryKey: ["resource-categories", area], queryFn: () => resourceService.categories(area) });
  const query = useQuery({
    queryKey: ["resources", area, debounced, category, type, page],
    queryFn: () => resourceService.list({ area, search: debounced, category: category || undefined, type: type || undefined, page, pageSize: 12 }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => resourceService.remove(id),
    onSuccess: () => { toast.success("Resource deleted"); setDeleting(null); qc.invalidateQueries({ queryKey: ["resources"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden /> Add resource</Button>}
      />

      {!!categories.data?.length && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Categories">
          {[{ name: "", count: 0 }, ...categories.data].map((c) => (
            <Button key={c.name || "all"} size="sm" variant={category === c.name ? "default" : "outline"} className="rounded-full" aria-pressed={category === c.name} onClick={() => { setCategory(c.name); setPage(1); }}>
              {c.name || "All"}{c.name ? ` (${c.count})` : ""}
            </Button>
          ))}
        </div>
      )}

      <FilterBar search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} searchPlaceholder={`Search ${copy.title}…`}>
        <div className="w-44">
          <label htmlFor={`type-${area}`} className="sr-only">Type</label>
          <NativeSelect id={`type-${area}`} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            {(Object.keys(TYPE_ICON) as ResourceType[]).map((t) => <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>)}
          </NativeSelect>
        </div>
      </FilterBar>

      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} moduleName={copy.module} empty={items.length === 0} emptyTitle="No resources found" emptyDescription={canManage ? "Add the first resource to this library." : "Try a different search or category."}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => {
            const Icon = TYPE_ICON[r.type];
            const canOpen = !!(r.url || r.fileId);
            return (
              <li key={r.id}>
                <Card className="h-full rounded-2xl shadow-sm">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon className="size-5" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-medium">{r.title}</h2>
                        <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                      </div>
                      {canManage && <Button size="icon" variant="ghost" aria-label={`Delete ${r.title}`} onClick={() => setDeleting(r)}><Trash2 className="size-4" /></Button>}
                    </div>
                    {r.description && <p className="line-clamp-2 text-sm text-muted-foreground">{r.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex gap-1.5">
                        <Badge variant="secondary" className="capitalize">{r.type.replace("_", " ").toLowerCase()}</Badge>
                        {r.category && <Badge variant="outline">{r.category}</Badge>}
                      </div>
                      {detailBase ? (
                        <Button size="sm" variant="outline" render={<Link href={`${detailBase}/${r.id}`} />}>View</Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={!canOpen} onClick={() => openResource(r)}><ExternalLink className="size-4" aria-hidden /> Open</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </QueryBoundary>

      <FormModal open={creating} onOpenChange={setCreating} title={`Add to ${copy.title}`}>
        <ResourceForm area={area} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["resources"] }); qc.invalidateQueries({ queryKey: ["resource-categories"] }); }} />
      </FormModal>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this resource?" confirmLabel="Delete" onConfirm={() => deleting && remove.mutate(deleting.id)} />
    </div>
  );
}
