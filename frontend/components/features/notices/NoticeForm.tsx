"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { adminSchoolApi } from "@/lib/api/admin";
import { classesLookup, type NoticeInput, type NoticeRow } from "@/lib/api/learning-ai";
import { academicsApi } from "@/lib/api/people";
import { useAuth } from "@/lib/auth";
import { isoToDateTimeInput } from "../shared";

export const NOTICE_TYPES = ["GENERAL", "ACADEMIC", "EVENT", "EMERGENCY", "HOLIDAY"] as const;
const ROLES = ["TEACHER", "STUDENT", "PARENT", "STAFF"] as const;

export const noticeSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    body: z.string().trim().min(1, "Message is required").max(10_000),
    type: z.enum(NOTICE_TYPES),
    mode: z.enum(["draft", "now", "schedule"]),
    publishAt: z.string().optional(),
    expiresAt: z.string().optional(),
    roles: z.array(z.string()),
    classIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "schedule" && !v.publishAt) ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Pick a publish date and time" });
    if (v.expiresAt && v.publishAt && v.mode === "schedule" && new Date(v.expiresAt) <= new Date(v.publishAt))
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must be after the publish time" });
  });
export type NoticeFormValues = z.infer<typeof noticeSchema>;

export const toNoticeInput = (v: NoticeFormValues): NoticeInput => ({
  title: v.title, body: v.body, type: v.type,
  publish: v.mode !== "draft",
  publishAt: v.mode === "schedule" && v.publishAt ? new Date(v.publishAt).toISOString() : undefined,
  expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
  targets: [...v.roles.map((roleName) => ({ roleName })), ...v.classIds.map((classId) => ({ classId }))],
});

export function NoticeForm({ initial, submitting, onSubmit }: { initial?: NoticeRow; submitting?: boolean; onSubmit: (v: NoticeInput) => void }) {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [schoolId, setSchoolId] = useState("");
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const schools = useQuery({ queryKey: ["schools", "options"], queryFn: () => adminSchoolApi.list({ pageSize: 100, sortBy: "name", sortOrder: "asc" }), enabled: isSuper && !initial });
  const classes = useQuery({
    queryKey: ["lookup", "classes", isSuper ? schoolId : "own"],
    queryFn: () => (isSuper ? academicsApi.classes.list({ pageSize: 100, schoolId }).then((r) => r.items) : classesLookup()),
    enabled: !isSuper || !!schoolId,
  });
  const scheduled = !!initial?.publishAt && new Date(initial.publishAt) > new Date();
  const { register, handleSubmit, control, formState: { errors } } = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: initial?.title ?? "", body: initial?.body ?? "", type: initial?.type ?? "GENERAL",
      mode: initial ? (initial.isPublished ? (scheduled ? "schedule" : "now") : "draft") : "now",
      publishAt: isoToDateTimeInput(scheduled ? initial?.publishAt : null), expiresAt: isoToDateTimeInput(initial?.expiresAt),
      roles: initial?.targets.flatMap((t) => (t.roleName ? [t.roleName] : [])) ?? [],
      classIds: initial?.targets.flatMap((t) => (t.classId ? [t.classId] : [])) ?? [],
    },
  });
  const mode = useWatch({ control, name: "mode" });

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => {
      if (isSuper && !initial && !schoolId) return setSchoolError("Choose the school this notice is for");
      onSubmit({ ...toNoticeInput(v), ...(isSuper && !initial ? { schoolId } : {}) });
    })}>
      {isSuper && !initial && (
        <FormField id="n-school" label="School" error={schoolError ?? undefined}>
          <NativeSelect id="n-school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setSchoolError(null); }}>
            <option value="">Select a school…</option>
            {schools.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </FormField>
      )}
      <FormField id="n-title" label="Title" error={errors.title?.message}>
        <Input id="n-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField id="n-body" label="Message" error={errors.body?.message}>
        <Textarea id="n-body" rows={4} aria-invalid={!!errors.body} {...register("body")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="n-type" label="Type">
          <NativeSelect id="n-type" {...register("type")}>
            {NOTICE_TYPES.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="n-mode" label="Publishing">
          <NativeSelect id="n-mode" {...register("mode")}>
            <option value="now">Publish now</option>
            <option value="schedule">Schedule</option>
            <option value="draft">Save as draft</option>
          </NativeSelect>
        </FormField>
      </div>
      {mode === "schedule" && (
        <FormField id="n-publish" label="Publish at" error={errors.publishAt?.message}>
          <Input id="n-publish" type="datetime-local" {...register("publishAt")} />
        </FormField>
      )}
      <FormField id="n-expiry" label="Expires at (optional)" error={errors.expiresAt?.message}>
        <Input id="n-expiry" type="datetime-local" {...register("expiresAt")} />
      </FormField>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Audience <span className="font-normal text-muted-foreground">(leave empty for the whole school)</span></legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2"><input type="checkbox" value={r} className="size-4 accent-primary" {...register("roles")} /> {r[0] + r.slice(1).toLowerCase()}s</label>
          ))}
        </div>
        {!!classes.data?.length && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {classes.data.map((c) => (
              <label key={c.id} className="flex items-center gap-2"><input type="checkbox" value={c.id} className="size-4 accent-primary" {...register("classIds")} /> {c.name}</label>
            ))}
          </div>
        )}
      </fieldset>
      {mode !== "draft" && !initial && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          When published, everyone in the audience gets a notification in the platform and an email.
        </p>
      )}
      <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : initial ? "Save changes" : mode === "draft" ? "Save draft" : mode === "schedule" ? "Schedule notice" : "Publish and notify everyone"}</Button>
    </form>
  );
}
