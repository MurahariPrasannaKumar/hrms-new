"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { http } from "@/lib/api/client";
import type { ResourceRow } from "@/lib/api/learning-ai";
import { fmtDate } from "@/lib/format";
import { parseVideoUrl } from "./video-utils";

/** Uploaded videos need the login token, so they are fetched as a blob and played from a local object URL. */
function UploadedVideo({ fileId, title }: { fileId: string; title: string }) {
  const q = useQuery({
    queryKey: ["video-blob", fileId],
    queryFn: async () => URL.createObjectURL((await http.get(`/files/${fileId}`, { responseType: "blob" })).data as Blob),
    staleTime: Infinity,
    gcTime: 0,
  });
  useEffect(() => () => { if (q.data) URL.revokeObjectURL(q.data); }, [q.data]);
  if (q.isLoading) return <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">Loading video…</div>;
  if (q.error || !q.data) return <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-destructive">This video could not be loaded.</div>;
  return <video className="aspect-video w-full rounded-xl bg-black" src={q.data} controls preload="metadata" aria-label={title} />;
}

export function VideoPlayerDialog({ resource, onClose }: { resource: ResourceRow | null; onClose: () => void }) {
  const src = parseVideoUrl(resource?.url);
  const by = resource?.uploadedBy ? `${resource.uploadedBy.firstName} ${resource.uploadedBy.lastName}` : null;

  return (
    <Dialog open={!!resource} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{resource?.title}</DialogTitle>
          <DialogDescription>{[by && `By ${by}`, resource && fmtDate(resource.createdAt)].filter(Boolean).join(" · ")}</DialogDescription>
        </DialogHeader>
        {resource && (
          <div className="space-y-4">
            {resource.fileId ? (
              <UploadedVideo fileId={resource.fileId} title={resource.title} />
            ) : src?.kind === "youtube" || src?.kind === "vimeo" ? (
              <iframe
                className="aspect-video w-full rounded-xl" src={src.embed} title={resource.title} loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : src?.kind === "file-url" ? (
              <video className="aspect-video w-full rounded-xl bg-black" src={src.src} controls preload="metadata" />
            ) : resource.url ? (
              <Button variant="outline" onClick={() => window.open(resource.url!, "_blank", "noopener")}><ExternalLink className="size-4" aria-hidden /> Open link</Button>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {resource.category && <Badge variant="secondary">{resource.category}</Badge>}
              {resource.class && <Badge variant="outline">{resource.class.name}</Badge>}
            </div>
            {resource.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{resource.description}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
