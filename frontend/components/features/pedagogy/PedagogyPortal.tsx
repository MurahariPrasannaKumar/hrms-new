"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FilterBar } from "@/components/forms/FilterBar";
import { FormModal } from "@/components/forms/FormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toApiError } from "@/lib/api/client";
import { resourceService, type ResourceRow } from "@/lib/api/learning-ai";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { QueryBoundary, useCan } from "../shared";
import { VideoPlayerDialog } from "./VideoPlayerDialog";
import { VideoUploadForm } from "./VideoUploadForm";
import { parseVideoUrl } from "./video-utils";

function Thumbnail({ r }: { r: ResourceRow }) {
  const thumb = parseVideoUrl(r.url)?.thumb;
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 to-orange-50">
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      )}
      <span className="relative flex size-12 items-center justify-center rounded-full bg-black/55 text-white"><PlayCircle className="size-7" aria-hidden /></span>
    </div>
  );
}

/** The LMS video library: teachers and admins post and remove videos, students watch the ones for their class. */
export function PedagogyPortal() {
  const { user } = useAuth();
  const can = useCan();
  const canManage = can("learning.manage");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const [playing, setPlaying] = useState<ResourceRow | null>(null);
  const [deleting, setDeleting] = useState<ResourceRow | null>(null);
  const debounced = useDebouncedValue(search, 300);

  const subjects = useQuery({ queryKey: ["resource-categories", "pedagogy"], queryFn: () => resourceService.categories("pedagogy") });
  const query = useQuery({
    queryKey: ["resources", "pedagogy", debounced, subject, page],
    queryFn: () => resourceService.list({ area: "pedagogy", search: debounced, category: subject || undefined, page, pageSize: 12 }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => resourceService.remove(id),
    onSuccess: () => { toast.success("Video removed"); setDeleting(null); qc.invalidateQueries({ queryKey: ["resources"] }); qc.invalidateQueries({ queryKey: ["resource-categories"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;
  // Teachers can remove only their own videos; admins can remove any.
  const canRemove = (r: ResourceRow) => canManage && (user?.role !== "TEACHER" || r.uploadedById === user.id);

  return (
    <div>
      <PageHeader
        title="Pedagogy"
        description={canManage ? "Video lessons for your classes. Post a video, or remove one you no longer need." : "Video lessons from your teachers."}
        actions={canManage && <Button onClick={() => setPosting(true)}><Plus className="size-4" aria-hidden /> Add video</Button>}
      />

      {!!subjects.data?.length && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Subjects">
          {[{ name: "", count: 0 }, ...subjects.data].map((c) => (
            <Button key={c.name || "all"} size="sm" variant={subject === c.name ? "default" : "outline"} className="rounded-full" aria-pressed={subject === c.name} onClick={() => { setSubject(c.name); setPage(1); }}>
              {c.name || "All subjects"}
            </Button>
          ))}
        </div>
      )}
      <FilterBar search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search videos…" />

      <QueryBoundary
        loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} moduleName="Pedagogy"
        empty={items.length === 0} emptyTitle="No videos yet"
        emptyDescription={canManage ? "Use “Add video” to post the first lesson." : "Videos your teachers post for your class will appear here."}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <li key={r.id} className="group flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm">
              <button type="button" className="text-left" onClick={() => setPlaying(r)} aria-label={`Play ${r.title}`}>
                <Thumbnail r={r} />
              </button>
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => setPlaying(r)}>
                  <h2 className="line-clamp-2 font-medium">{r.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.uploadedBy ? `${r.uploadedBy.firstName} ${r.uploadedBy.lastName} · ` : ""}{fmtDate(r.createdAt)}
                  </p>
                </button>
                {canRemove(r) && (
                  <Button size="icon" variant="ghost" aria-label={`Remove ${r.title}`} onClick={() => setDeleting(r)}><Trash2 className="size-4" /></Button>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {r.category && <Badge variant="secondary">{r.category}</Badge>}
                <Badge variant="outline">{r.class?.name ?? "Whole school"}</Badge>
              </div>
            </li>
          ))}
        </ul>
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </QueryBoundary>

      <FormModal open={posting} onOpenChange={setPosting} title="Add a video lesson" description="Students in the class you choose will see it under Pedagogy.">
        {posting && (
          <VideoUploadForm onDone={(posted) => {
            setPosting(false);
            if (posted) { qc.invalidateQueries({ queryKey: ["resources"] }); qc.invalidateQueries({ queryKey: ["resource-categories"] }); }
          }} />
        )}
      </FormModal>
      <VideoPlayerDialog resource={playing} onClose={() => setPlaying(null)} />
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Remove this video?"
        description="Students will no longer be able to watch it. An uploaded video file is deleted too." confirmLabel="Remove"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
