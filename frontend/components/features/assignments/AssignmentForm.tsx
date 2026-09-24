"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useAssignableClasses } from "@/hooks/useLookups";
import { subjectsLookup, type AssignmentInput, type AssignmentRow } from "@/lib/api/learning-ai";
import { dateInputToIso, isoToDateInput } from "../shared";

const schema = z.object({
  classId: z.string().min(1, "Choose a class"),
  subjectId: z.string().min(1, "Choose a subject"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(10_000).optional(),
  dueDate: z.string().optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  initial?: AssignmentRow;
  submitting?: boolean;
  /** `file` is a newly chosen attachment that the caller uploads; `notify` asks the server to email and notify the class. */
  onSubmit: (v: AssignmentInput, file: File | null) => void;
}

export function AssignmentForm({ initial, submitting, onSubmit }: Props) {
  const classes = useAssignableClasses();
  const subjects = useQuery({ queryKey: ["lookup", "subjects"], queryFn: subjectsLookup });
  const [file, setFile] = useState<File | null>(null);
  const [notify, setNotify] = useState(true);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      classId: initial?.classId ?? "", subjectId: initial?.subjectId ?? "", title: initial?.title ?? "",
      description: initial?.description ?? "", dueDate: isoToDateInput(initial?.dueDate),
    },
  });
  const noClasses = !classes.isLoading && !(classes.data ?? []).length;

  return (
    <form
      className="space-y-4" noValidate
      onSubmit={handleSubmit((v) => onSubmit({ ...v, description: v.description || undefined, dueDate: dateInputToIso(v.dueDate), ...(initial ? {} : { notify }) }, file))}
    >
      {noClasses && !initial && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          You are not assigned to any class yet. Choose the classes you teach under <strong>My profile → Classes I teach</strong>, then come back.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="as-class" label="Send to class" error={errors.classId?.message}>
          <NativeSelect id="as-class" disabled={!!initial} {...register("classId")}>
            <option value="">Select class</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="as-subject" label="Subject" error={errors.subjectId?.message}>
          <NativeSelect id="as-subject" disabled={!!initial} {...register("subjectId")}>
            <option value="">Select subject</option>
            {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <FormField id="as-title" label="Title" error={errors.title?.message}>
        <Input id="as-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField id="as-desc" label="Instructions (optional)">
        <Textarea id="as-desc" rows={4} {...register("description")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="as-due" label="Due date">
          <Input id="as-due" type="date" {...register("dueDate")} />
        </FormField>
        <FormField id="as-file" label={initial?.fileId ? "Replace attachment (optional)" : "Attachment (optional)"}>
          <Input id="as-file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </FormField>
      </div>
      {!initial && (
        <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span>
            <span className="font-medium">Email and notify the class</span>
            <span className="block text-muted-foreground">Every student in the selected class gets a notification in the platform and an email with the details.</span>
          </span>
        </label>
      )}
      <Button type="submit" disabled={submitting || (noClasses && !initial)}>{submitting ? "Saving…" : initial ? "Save changes" : notify ? "Create and send to class" : "Create assignment"}</Button>
    </form>
  );
}
