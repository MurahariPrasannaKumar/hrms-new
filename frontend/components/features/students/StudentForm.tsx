"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentInput, StudentRow } from "@/lib/api/people";
import { studentSchema, type StudentFormValues } from "@/schemas/people";

export interface ClassOption { id: string; name: string; sections: { id: string; name: string }[] }

interface Props {
  classes: ClassOption[];
  parents: { id: string; name: string }[];
  initial?: Partial<StudentRow> & { dateOfBirth?: string | null; admissionDate?: string | null; address?: string | null; parentId?: string | null };
  submitting?: boolean;
  onSubmit: (values: StudentInput) => void;
  onCancel: () => void;
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);

export function toStudentDefaults(i?: Props["initial"]): StudentFormValues {
  return {
    admissionNumber: i?.admissionNumber ?? "",
    firstName: i?.firstName ?? "",
    lastName: i?.lastName ?? "",
    dateOfBirth: day(i?.dateOfBirth),
    gender: i?.gender ?? "",
    email: i?.email ?? "",
    phone: i?.phone ?? "",
    address: i?.address ?? "",
    parentId: i?.parentId ?? "",
    classId: i?.classId ?? "",
    sectionId: i?.sectionId ?? "",
    admissionDate: day(i?.admissionDate),
    status: i?.status ?? "ACTIVE",
  };
}

export function toStudentInput(v: StudentFormValues, editing: boolean): StudentInput {
  const nullable = (s?: string) => (blank(s) ?? (editing ? null : undefined));
  return {
    admissionNumber: v.admissionNumber,
    firstName: v.firstName,
    lastName: v.lastName,
    dateOfBirth: blank(v.dateOfBirth),
    gender: v.gender || undefined,
    email: blank(v.email),
    phone: blank(v.phone),
    address: blank(v.address),
    parentId: nullable(v.parentId),
    classId: nullable(v.classId),
    sectionId: nullable(v.sectionId),
    admissionDate: blank(v.admissionDate),
    status: v.status,
  };
}

export function StudentForm({ classes, parents, initial, submitting, onSubmit, onCancel }: Props) {
  const editing = !!initial?.id;
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: toStudentDefaults(initial),
  });

  const classId = useWatch({ control, name: "classId" });
  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(toStudentInput(v, editing)))} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="st-first" label="First name" error={errors.firstName?.message}>
          <Input id="st-first" aria-invalid={!!errors.firstName} {...register("firstName")} />
        </FormField>
        <FormField id="st-last" label="Last name" error={errors.lastName?.message}>
          <Input id="st-last" aria-invalid={!!errors.lastName} {...register("lastName")} />
        </FormField>
        <FormField id="st-adm" label="Admission number" error={errors.admissionNumber?.message}>
          <Input id="st-adm" aria-invalid={!!errors.admissionNumber} {...register("admissionNumber")} />
        </FormField>
        <FormField id="st-status" label="Status">
          <NativeSelect id="st-status" {...register("status")}>
            {["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="st-dob" label="Date of birth">
          <Input id="st-dob" type="date" {...register("dateOfBirth")} />
        </FormField>
        <FormField id="st-gender" label="Gender">
          <NativeSelect id="st-gender" placeholder="Not specified" options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} {...register("gender")} />
        </FormField>
        <FormField id="st-email" label="Email" error={errors.email?.message}>
          <Input id="st-email" type="email" aria-invalid={!!errors.email} {...register("email")} />
        </FormField>
        <FormField id="st-phone" label="Phone">
          <Input id="st-phone" type="tel" {...register("phone")} />
        </FormField>
        <FormField id="st-class" label="Class">
          <NativeSelect
            id="st-class"
            placeholder="Unassigned"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            {...register("classId", { onChange: () => setValue("sectionId", "") })}
          />
          {classes.length === 0 && <p className="text-xs text-muted-foreground">No classes yet. Create an academic year and a class under Academics first.</p>}
        </FormField>
        <FormField id="st-section" label="Section">
          <NativeSelect id="st-section" placeholder="Unassigned" disabled={!classId} options={sections.map((s) => ({ value: s.id, label: s.name }))} {...register("sectionId")} />
        </FormField>
        <FormField id="st-parent" label="Parent">
          <NativeSelect id="st-parent" placeholder="No parent linked" options={parents.map((p) => ({ value: p.id, label: p.name }))} {...register("parentId")} />
          {parents.length === 0 && <p className="text-xs text-muted-foreground">No parent accounts yet. Create a user with the Parent role first.</p>}
        </FormField>
        <FormField id="st-admdate" label="Admission date">
          <Input id="st-admdate" type="date" {...register("admissionDate")} />
        </FormField>
      </div>
      <FormField id="st-address" label="Address">
        <Input id="st-address" {...register("address")} />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Add student"}</Button>
      </div>
    </form>
  );
}
