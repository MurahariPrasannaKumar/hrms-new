"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toApiError } from "@/lib/api/client";
import { academicsApi, studentsApi, type ExamRow } from "@/lib/api/people";
import { fullName } from "@/lib/format";
import { QueryBoundary } from "../shared";

interface Props { exam: ExamRow | null; canEdit: boolean; onClose: () => void }

interface Person { id: string; name: string; adm: string }

function ResultsForm({ exam, students, initialMarks, initialGrades, canEdit, onClose }: {
  exam: ExamRow; students: Person[]; initialMarks: Record<string, string>; initialGrades: Record<string, string>; canEdit: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState(initialMarks);
  const [grades, setGrades] = useState(initialGrades);
  const max = exam.maxMarks;
  const invalid = (id: string) => {
    const v = marks[id];
    return v !== undefined && v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > max);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = Object.entries(marks)
        .filter(([, v]) => v !== "")
        .map(([studentId, v]) => ({ studentId, marks: Number(v), grade: grades[studentId]?.trim() || undefined }));
      return academicsApi.saveResults(exam.id, payload);
    },
    onSuccess: () => {
      toast.success("Results saved");
      qc.invalidateQueries({ queryKey: ["exam-results", exam.id] });
      qc.invalidateQueries({ queryKey: ["student"] });
      onClose();
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const anyInvalid = students.some((s) => invalid(s.id));
  const hasMarks = Object.values(marks).some((v) => v !== "");

  return (
    <>
      <ul className="divide-y">
        {students.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.adm}</p>
            </div>
            {canEdit ? (
              <>
                <Input aria-label={`Marks for ${s.name}`} inputMode="decimal" className="w-20" aria-invalid={invalid(s.id)} value={marks[s.id] ?? ""} onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))} />
                <Input aria-label={`Grade for ${s.name}`} maxLength={5} className="w-16" value={grades[s.id] ?? ""} onChange={(e) => setGrades((g) => ({ ...g, [s.id]: e.target.value }))} />
              </>
            ) : (
              <span className="text-sm font-medium">{marks[s.id]}/{max}{grades[s.id] ? ` · ${grades[s.id]}` : ""}</span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {anyInvalid && <p role="alert" className="mr-auto text-sm text-destructive">Marks must be between 0 and {max}.</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={anyInvalid || !hasMarks || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save results"}</Button>
        </div>
      )}
    </>
  );
}

export function ResultsDialog({ exam, canEdit, onClose }: Props) {
  const results = useQuery({ queryKey: ["exam-results", exam?.id], queryFn: () => academicsApi.results(exam!.id), enabled: !!exam });
  const roster = useQuery({
    queryKey: ["exam-roster", exam?.classId],
    queryFn: () => studentsApi.list({ classId: exam!.classId, pageSize: 100 }),
    enabled: !!exam && canEdit,
  });

  const students: Person[] = canEdit
    ? (roster.data?.items ?? []).map((s) => ({ id: s.id, name: fullName(s), adm: s.admissionNumber }))
    : (results.data?.results ?? []).map((r) => ({ id: r.studentId, name: fullName(r.student), adm: r.student.admissionNumber }));
  const initialMarks = Object.fromEntries((results.data?.results ?? []).map((r) => [r.studentId, String(r.marks)]));
  const initialGrades = Object.fromEntries((results.data?.results ?? []).map((r) => [r.studentId, r.grade ?? ""]));

  return (
    <Dialog open={!!exam} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{exam?.name} results</DialogTitle>
          <DialogDescription>Marks out of {exam?.maxMarks ?? 100}.</DialogDescription>
        </DialogHeader>
        <QueryBoundary
          loading={results.isLoading || (canEdit && roster.isLoading)}
          error={results.error ?? roster.error}
          onRetry={() => { results.refetch(); roster.refetch(); }}
          empty={students.length === 0}
          emptyTitle="No students to show"
          emptyDescription={canEdit ? "This class has no students yet." : "Results have not been published."}
        >
          {exam && results.data && (
            <ResultsForm key={`${exam.id}-${results.dataUpdatedAt}-${roster.dataUpdatedAt}`} exam={exam} students={students} initialMarks={initialMarks} initialGrades={initialGrades} canEdit={canEdit} onClose={onClose} />
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}
