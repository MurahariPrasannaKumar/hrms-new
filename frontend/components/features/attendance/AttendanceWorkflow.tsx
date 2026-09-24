"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/forms/FormField";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { Input } from "@/components/ui/input";
import { useAssignableClasses } from "@/hooks/useLookups";
import { toApiError } from "@/lib/api/client";
import { attendanceRosterApi } from "@/lib/api/people";
import { isoDay } from "@/lib/format";
import { QueryBoundary } from "../shared";
import { RosterMarker } from "./RosterMarker";

/** Teacher workflow: class → section → date → roster → mark → save. */
export function AttendanceWorkflow() {
  const qc = useQueryClient();
  const classes = useAssignableClasses();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(isoDay());

  const all = classes.data ?? [];
  const sections = all.find((c) => c.id === classId)?.sections ?? [];
  const ready = !!sectionId && !!date;

  const roster = useQuery({
    queryKey: ["roster", sectionId, date],
    queryFn: () => attendanceRosterApi.roster(sectionId, date),
    enabled: ready,
    staleTime: 0,
    gcTime: 0,
  });

  const save = useMutation({
    mutationFn: (records: { studentId: string; status: import("@/lib/api/people").AttendanceStatus }[]) => attendanceRosterApi.mark(sectionId, date, records),
    onSuccess: () => {
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  if (!classes.isLoading && all.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No classes available yet. An administrator needs to create an academic year and a class with sections, then assign you to it (Teachers, your profile, Classes).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-3">
        <FormField id="att-class" label="Class">
          <NativeSelect id="att-class" placeholder="Select class" value={classId} options={all.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} />
        </FormField>
        <FormField id="att-section" label="Section">
          <NativeSelect id="att-section" placeholder="Select section" disabled={!classId} value={sectionId} options={sections.map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => setSectionId(e.target.value)} />
        </FormField>
        <FormField id="att-date" label="Date">
          <Input id="att-date" type="date" max={isoDay()} value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>

      {!ready ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Select a class, section and date to load the roster.</p>
      ) : (
        <QueryBoundary loading={roster.isLoading} error={roster.error} onRetry={() => roster.refetch()}>
          {roster.data && (
            <RosterMarker key={`${sectionId}-${date}-${roster.dataUpdatedAt}`} students={roster.data.students} saving={save.isPending} onSave={(r) => save.mutate(r)} />
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
