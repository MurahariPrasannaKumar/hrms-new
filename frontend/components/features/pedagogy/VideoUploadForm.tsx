"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAssignableClasses } from "@/hooks/useLookups";
import { http, toApiError, unwrap } from "@/lib/api/client";
import { resourceService, subjectsLookup } from "@/lib/api/learning-ai";
import { useAuth } from "@/lib/auth";
import { MAX_VIDEO_MB, parseVideoUrl } from "./video-utils";

/** Post a lesson video: upload a file from the computer, or paste a YouTube/Vimeo/video link. */
export function VideoUploadForm({ onDone }: { onDone: (posted: boolean) => void }) {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const classes = useAssignableClasses();
  const subjects = useQuery({ queryKey: ["lookup", "subjects"], queryFn: subjectsLookup });
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [classId, setClassId] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const noClasses = isTeacher && !classes.isLoading && !(classes.data ?? []).length;

  const save = useMutation({
    mutationFn: async () => {
      let fileId: string | undefined;
      if (mode === "upload") {
        if (!file) throw new Error("Choose a video file");
        const form = new FormData();
        form.append("file", file);
        const uploaded = await unwrap<{ id: string }>(
          http.post("/files", form, { onUploadProgress: (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0) }),
        );
        fileId = uploaded.id;
      } else if (!parseVideoUrl(link)) {
        throw new Error("Enter a valid video link (https://…)");
      }
      return resourceService.create({
        title: title.trim(), description: description.trim() || undefined, type: "VIDEO", area: "pedagogy",
        category: category || undefined, classId: classId || undefined, ...(fileId ? { fileId } : { url: link.trim() }),
      });
    },
    onSuccess: () => { toast.success("Video posted"); onDone(true); },
    onError: (e) => toast.error(e instanceof Error && !("response" in e) ? e.message : toApiError(e).message),
  });

  const pick = (f: File | null) => {
    if (f && !f.type.startsWith("video/")) return toast.error("Please choose a video file (MP4 or WebM).");
    if (f && f.size > MAX_VIDEO_MB * 1024 * 1024) return toast.error(`Videos up to ${MAX_VIDEO_MB} MB can be uploaded. For larger videos, paste a YouTube or Vimeo link instead.`);
    setFile(f);
  };

  const ready = title.trim() && (isTeacher ? classId : true) && (mode === "upload" ? !!file : !!link.trim());

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {noClasses && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          You are not assigned to any class yet. Choose the classes you teach under <strong>My profile → Classes I teach</strong> first.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pv-title">Title</Label>
        <Input id="pv-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pv-class">For class</Label>
          <NativeSelect id="pv-class" value={classId} placeholder={isTeacher ? "Select class" : "Whole school"} onChange={(e) => setClassId(e.target.value)}
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pv-subject">Subject</Label>
          <NativeSelect id="pv-subject" value={category} placeholder="Select subject" onChange={(e) => setCategory(e.target.value)}
            options={(subjects.data ?? []).map((s) => ({ value: s.name, label: s.name }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pv-desc">Description (optional)</Label>
        <Textarea id="pv-desc" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 text-sm" role="tablist" aria-label="Video source">
        {(["upload", "link"] as const).map((m) => (
          <button
            key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-1.5 font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "upload" ? "Upload a video" : "Paste a link"}
          </button>
        ))}
      </div>
      {mode === "upload" ? (
        <div className="space-y-1.5">
          <Label htmlFor="pv-file">Video file (MP4 or WebM, up to {MAX_VIDEO_MB} MB)</Label>
          <Input id="pv-file" type="file" accept="video/mp4,video/webm" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {save.isPending && progress > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="pv-link">Video link (YouTube, Vimeo or a direct .mp4)</Label>
          <Input id="pv-link" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onDone(false)}>Cancel</Button>
        <Button type="submit" disabled={save.isPending || !ready || noClasses}>
          {save.isPending ? (mode === "upload" ? `Uploading… ${progress}%` : "Posting…") : "Post video"}
        </Button>
      </div>
    </form>
  );
}
