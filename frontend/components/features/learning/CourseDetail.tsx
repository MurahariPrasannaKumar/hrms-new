"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toApiError } from "@/lib/api/client";
import { courseService, type LessonRow } from "@/lib/api/learning-ai";
import { QueryBoundary } from "../shared";
import { ProgressBar } from "./ProgressBar";

export function CourseDetail({ id, backHref }: { id: string; backHref: string }) {
  const qc = useQueryClient();
  const [active, setActive] = useState<LessonRow | null>(null);
  const query = useQuery({ queryKey: ["course", id], queryFn: () => courseService.get(id) });
  const complete = useMutation({
    mutationFn: (lessonId: string) => courseService.completeLesson(lessonId),
    onSuccess: (r) => {
      toast.success(r.completionPercent === 100 ? "Course completed. Well done!" : "Lesson completed");
      qc.invalidateQueries({ queryKey: ["course", id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["learning-certificates"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const course = query.data;
  const selected = active ? course?.modules.flatMap((m) => m.lessons).find((l) => l.id === active.id) ?? active : null;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" render={<Link href={backHref} />}><ArrowLeft className="size-4" aria-hidden /> All courses</Button>
      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} moduleName="Learn 2.0">
        {course && (
          <>
            <PageHeader title={course.title} description={course.description ?? undefined} />
            <div className="mb-6 max-w-md"><ProgressBar value={course.completionPercent} label="Course progress" /></div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="space-y-4">
                {course.modules.length === 0 && <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>}
                {course.modules.map((m, mi) => (
                  <section key={m.id} aria-labelledby={`mod-${m.id}`}>
                    <h2 id={`mod-${m.id}`} className="mb-2 text-sm font-semibold">Module {mi + 1}: {m.title}</h2>
                    <ul className="space-y-1.5">
                      {m.lessons.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button" onClick={() => setActive(l)} aria-current={selected?.id === l.id}
                            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${selected?.id === l.id ? "border-primary bg-orange-50/50" : ""}`}
                          >
                            {l.completed ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Completed" /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="Not completed" />}
                            {l.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <Card className="h-fit rounded-2xl shadow-sm">
                <CardContent className="space-y-3 p-5">
                  {selected ? (
                    <>
                      <h2 className="text-lg font-semibold">{selected.title}</h2>
                      {selected.videoUrl && (
                        <a className="inline-flex items-center gap-1 text-sm text-primary underline" href={selected.videoUrl} target="_blank" rel="noreferrer"><PlayCircle className="size-4" aria-hidden /> Watch video</a>
                      )}
                      <p className="whitespace-pre-wrap text-sm">{selected.content ?? "Lesson content will be added soon."}</p>
                      <Button disabled={selected.completed || complete.isPending} onClick={() => complete.mutate(selected.id)}>
                        {selected.completed ? "Completed" : complete.isPending ? "Saving…" : "Mark lesson complete"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a lesson to begin.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
