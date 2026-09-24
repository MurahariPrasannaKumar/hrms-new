"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeacherCreate, TeacherRow } from "@/lib/api/people";
import { passwordRule, teacherSchema, type TeacherFormValues } from "@/schemas/people";

interface Props {
  initial?: TeacherRow;
  submitting?: boolean;
  onSubmit: (values: TeacherCreate) => void;
  onCancel: () => void;
}

const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);

export function TeacherForm({ initial, submitting, onSubmit, onCancel }: Props) {
  const editing = !!initial;
  const { register, handleSubmit, setError, formState: { errors } } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      firstName: initial?.user.firstName ?? "",
      lastName: initial?.user.lastName ?? "",
      employeeId: initial?.employeeId ?? "",
      email: initial?.user.email ?? "",
      password: "",
      phone: initial?.phone ?? "",
      qualification: initial?.qualification ?? "",
      joiningDate: initial?.joiningDate?.slice(0, 10) ?? "",
    },
  });

  const submit = (v: TeacherFormValues) => {
    if (!editing) {
      const pw = passwordRule.safeParse(v.password);
      if (!pw.success) return setError("password", { message: pw.error.issues[0]?.message ?? "Invalid password" });
    }
    onSubmit({
      firstName: v.firstName, lastName: v.lastName, employeeId: v.employeeId, email: v.email, password: v.password ?? "",
      phone: blank(v.phone), qualification: blank(v.qualification), joiningDate: blank(v.joiningDate),
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="t-first" label="First name" error={errors.firstName?.message}>
          <Input id="t-first" aria-invalid={!!errors.firstName} {...register("firstName")} />
        </FormField>
        <FormField id="t-last" label="Last name" error={errors.lastName?.message}>
          <Input id="t-last" aria-invalid={!!errors.lastName} {...register("lastName")} />
        </FormField>
        <FormField id="t-emp" label="Employee ID" error={errors.employeeId?.message}>
          <Input id="t-emp" aria-invalid={!!errors.employeeId} {...register("employeeId")} />
        </FormField>
        <FormField id="t-email" label="Email" error={errors.email?.message}>
          <Input id="t-email" type="email" disabled={editing} aria-invalid={!!errors.email} {...register("email")} />
        </FormField>
        {!editing && (
          <FormField id="t-pw" label="Temporary password" error={errors.password?.message}>
            <Input id="t-pw" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          </FormField>
        )}
        <FormField id="t-phone" label="Phone">
          <Input id="t-phone" type="tel" {...register("phone")} />
        </FormField>
        <FormField id="t-qual" label="Qualification">
          <Input id="t-qual" {...register("qualification")} />
        </FormField>
        <FormField id="t-join" label="Joining date">
          <Input id="t-join" type="date" {...register("joiningDate")} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Add teacher"}</Button>
      </div>
    </form>
  );
}
