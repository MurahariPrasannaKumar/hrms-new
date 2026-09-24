"use client";

import { useMutation } from "@tanstack/react-query";
import { Lightbulb, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api/client";
import { aiService, fileService } from "@/lib/api/learning-ai";
import { isModuleDisabled, ModuleDisabled } from "../shared";

export function InstasolvePage() {
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const solve = useMutation({
    mutationFn: async () => {
      const fileId = image ? (await fileService.upload(image)).id : undefined;
      return aiService.solve(question.trim(), fileId);
    },
    onError: (e) => { if (!isModuleDisabled(e)) toast.error(toApiError(e).message); },
  });

  if (isModuleDisabled(solve.error)) return <div><PageHeader title="Instasolve" /><ModuleDisabled name="Instasolve" /></div>;
  const r = solve.data;

  return (
    <div>
      <PageHeader title="Instasolve" description="Type a question or attach a photo to get a step-by-step solution." />
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm" onSubmit={(e) => { e.preventDefault(); if (question.trim()) solve.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="is-question">Your question</Label>
            <Textarea id="is-question" rows={6} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Solve 2x + 5 = 17" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="is-image">Photo (optional)</Label>
            <Input id="is-image" type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" disabled={!question.trim() || solve.isPending}><Sparkles className="size-4" aria-hidden /> {solve.isPending ? "Solving…" : "Solve"}</Button>
        </form>

        <div aria-live="polite">
          {solve.isPending && <div role="status" className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">Working on your solution…</div>}
          {solve.isError && !solve.isPending && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{toApiError(solve.error).message}</div>}
          {!r && !solve.isPending && !solve.isError && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Your explanation will appear here.</div>
          )}
          {r && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5">
                <section><h2 className="text-sm font-semibold">Explanation</h2><p className="mt-1 whitespace-pre-wrap text-sm">{r.explanation}</p></section>
                {r.steps.length > 0 && (
                  <section><h2 className="text-sm font-semibold">Steps</h2><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>
                )}
                <section className="rounded-xl bg-emerald-50 p-3"><h2 className="text-sm font-semibold text-emerald-800">Answer</h2><p className="mt-1 text-sm text-emerald-900">{r.answer}</p></section>
                {r.relatedConcepts.length > 0 && (
                  <section>
                    <h2 className="flex items-center gap-1 text-sm font-semibold"><Lightbulb className="size-4" aria-hidden /> Related concepts</h2>
                    <div className="mt-2 flex flex-wrap gap-2">{r.relatedConcepts.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                  </section>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
