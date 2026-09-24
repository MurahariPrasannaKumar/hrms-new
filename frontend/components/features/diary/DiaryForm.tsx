"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useAssignableClasses } from "@/hooks/useLookups";
import { subjectsLookup, type DiaryInput, type DiaryRow } from "@/lib/api/learning-ai";
import { dateInputToIso, isoToDateInput } from "../shared";

export const diarySchema = z.object({
  classId: z.string().min(1, "Choose a class"),
  sectionId: z.string().optional(),
  subjectId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Write something for the entry").max(10_000),
  isHomework: z.boolean(),
  dueDate: z.string().optional(),
});
export type DiaryFormValues = z.infer<typeof diarySchema>;

interface Props {
  initial?: DiaryRow;
  submitting?: boolean;
  onSubmit: (input: DiaryInput) => void;
}

export function DiaryForm({ initial, submitting, onSubmit }: Props) {
  const classes = useAssignableClasses();
  const subjects = useQuery({ queryKey: ["lookup", "subjects"], queryFn: subjectsLookup });
  const form = useForm<DiaryFormValues>({
    resolver: zodResolver(diarySchema),
    defaultValues: {
      classId: initial?.classId ?? "", sectionId: initial?.sectionId ?? "", subjectId: initial?.subjectId ?? "",
      title: initial?.title ?? "", body: initial?.body ?? "", isHomework: initial?.isHomework ?? false,
      dueDate: isoToDateInput(initial?.dueDate),
    },
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  const classId = useWatch({ control, name: "classId" });
  const sections = classes.data?.find((c) => c.id === classId)?.sections ?? [];

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit((v) =>
        onSubmit({
          classId: v.classId, sectionId: v.sectionId || undefined, subjectId: v.subjectId || undefined,
          title: v.title, body: v.body, isHomework: v.isHomework, dueDate: dateInputToIso(v.dueDate),
        }),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="diary-class" label="Class" error={errors.classId?.message}>
          <NativeSelect id="diary-class" disabled={!!initial} aria-invalid={!!errors.classId} {...register("classId")}>
            <option value="">Select class</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          {!classes.isLoading && !classes.data?.length && (
            <p className="text-xs text-muted-foreground">No classes available. Ask an administrator to create a class and assign you to it.</p>
          )}
        </FormField>
        <FormField id="diary-section" label="Section (optional)">
          <NativeSelect id="diary-section" disabled={!!initial} {...register("sectionId")}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <FormField id="diary-subject" label="Subject (optional)">
        <NativeSelect id="diary-subject" {...register("subjectId")}>
          <option value="">General</option>
          {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="diary-title" label="Title" error={errors.title?.message}>
        <Input id="diary-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField id="diary-body" label="Notes" error={errors.body?.message}>
        <Textarea id="diary-body" rows={4} aria-invalid={!!errors.body} {...register("body")} />
      </FormField>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register("isHomework")} /> This is homework
        </label>
        <FormField id="diary-due" label="Due date">
          <Input id="diary-due" type="date" {...register("dueDate")} />
        </FormField>
      </div>
      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Saving…" : initial ? "Save changes" : "Create entry"}
      </Button>
    </form>
  );
}
