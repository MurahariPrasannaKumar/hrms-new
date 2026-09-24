"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, BookOpen, Route } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { courseService } from "@/lib/api/learning-ai";
import { QueryBoundary } from "../shared";
import { ProgressBar } from "./ProgressBar";

export function LearnPage({ courseBase }: { courseBase: string }) {
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => courseService.list({ pageSize: 50 }) });
  const paths = useQuery({ queryKey: ["learning-paths"], queryFn: courseService.paths });
  const certs = useQuery({ queryKey: ["learning-certificates"], queryFn: courseService.certificates });
  const items = courses.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Learn 2.0" description="Courses, learning paths and your progress." />
      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses"><BookOpen className="size-4" aria-hidden /> Courses</TabsTrigger>
          <TabsTrigger value="paths"><Route className="size-4" aria-hidden /> Paths</TabsTrigger>
          <TabsTrigger value="certificates"><Award className="size-4" aria-hidden /> Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          <QueryBoundary loading={courses.isLoading} error={courses.error} onRetry={() => courses.refetch()} moduleName="Learn 2.0" empty={items.length === 0} emptyTitle="No courses yet" emptyDescription="Courses published for your school will appear here.">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => (
                <li key={c.id}>
                  <Card className="h-full rounded-2xl shadow-sm">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div>
                        {c.category && <Badge variant="outline" className="mb-2">{c.category}</Badge>}
                        <h2 className="font-medium">{c.title}</h2>
                        {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.moduleCount ?? 0} modules · {c.lessonCount ?? 0} lessons</p>
                      <ProgressBar value={c.completionPercent} label={`${c.title} progress`} />
                      <Button className="mt-auto" size="sm" variant={c.completionPercent > 0 ? "default" : "outline"} render={<Link href={`${courseBase}/${c.id}`} />}>
                        {c.completionPercent === 100 ? "Review" : c.completionPercent > 0 ? "Continue" : "Start"}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </QueryBoundary>
        </TabsContent>

        <TabsContent value="paths" className="mt-4">
          <QueryBoundary loading={paths.isLoading} error={paths.error} onRetry={() => paths.refetch()} empty={(paths.data ?? []).length === 0} emptyTitle="No learning paths" emptyDescription="Paths group courses into a guided sequence.">
            <ul className="space-y-3">
              {paths.data?.map((p) => (
                <li key={p.id}>
                  <Card className="rounded-2xl shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <h2 className="font-medium">{p.title}</h2>
                        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                      </div>
                      <ol className="flex flex-wrap gap-2 text-sm">
                        {p.courses.map((c, i) => (
                          <li key={c.id}><Link className="rounded-full border px-3 py-1 hover:bg-muted" href={`${courseBase}/${c.id}`}>{i + 1}. {c.title}</Link></li>
                        ))}
                      </ol>
                      <ProgressBar value={p.completionPercent} label={`${p.title} progress`} />
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </QueryBoundary>
        </TabsContent>

        <TabsContent value="certificates" className="mt-4">
          <QueryBoundary loading={certs.isLoading} error={certs.error} onRetry={() => certs.refetch()}>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              {certs.data?.items.length ? (
                <ul className="space-y-2">
                  {certs.data.items.map((c) => (
                    <li key={c.courseId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{c.courseTitle}</span>
                      <Badge variant="secondary">Eligible</Badge>
                    </li>
                  ))}
                  <li className="pt-2 text-xs text-muted-foreground">Downloadable certificates are coming soon.</li>
                </ul>
              ) : (
                <EmptyState compact title="No certificates yet" description="Complete every lesson in a course to become eligible. Downloadable certificates are coming soon." />
              )}
            </div>
          </QueryBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
