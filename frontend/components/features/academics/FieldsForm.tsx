"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField";
import { NativeSelect, type Option } from "@/components/forms/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "checkbox";
  options?: Option[];
  required?: boolean;
  disabled?: boolean;
}

type Values = Record<string, string | boolean>;

interface Props {
  fields: FieldDef[];
  initial?: Values;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (values: Values) => void;
  onCancel: () => void;
}

/** Config-driven RHF + zod form for small master-data records (years, classes, subjects, exams, sections). */
export function FieldsForm({ fields, initial, submitLabel = "Save", submitting, onSubmit, onCancel }: Props) {
  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          fields.map((f) => {
            if (f.type === "checkbox") return [f.name, z.boolean()];
            const base = z.string().trim();
            const withType = f.type === "number" ? base.refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a number") : base;
            return [f.name, f.required ? withType.pipe(z.string().min(1, `${f.label} is required`)) : withType];
          }),
        ),
      ),
    [fields],
  );
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? (f.type === "checkbox" ? false : "")])),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const err = errors[f.name]?.message as string | undefined;
        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" {...register(f.name)} /> {f.label}
            </label>
          );
        }
        return (
          <FormField key={f.name} id={id} label={f.label} error={err}>
            {f.type === "select" ? (
              <NativeSelect id={id} placeholder="Select…" disabled={f.disabled} options={f.options ?? []} aria-invalid={!!err} {...register(f.name)} />
            ) : (
              <Input id={id} type={f.type ?? "text"} disabled={f.disabled} aria-invalid={!!err} {...register(f.name)} />
            )}
          </FormField>
        );
      })}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
