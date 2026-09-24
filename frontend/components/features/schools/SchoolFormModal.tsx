"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms/FormField";
import { FormModal } from "@/components/forms/FormModal";
import { SelectField } from "@/components/features/shared/SelectField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSchoolApi, type SchoolRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { schoolFormSchema, toSchoolPayload, type SchoolFormValues } from "@/schemas/school";

const empty: SchoolFormValues = {
  name: "", code: "", email: "", phone: "", address: "", city: "", state: "", country: "",
  postalCode: "", principal: "", establishedYear: "", logoUrl: "", status: "ACTIVE",
};

const fromRow = (s: SchoolRow): SchoolFormValues => ({
  name: s.name, code: s.code, email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "",
  city: s.city ?? "", state: s.state ?? "", country: s.country ?? "", postalCode: s.postalCode ?? "",
  principal: s.principal ?? "", establishedYear: s.establishedYear ? String(s.establishedYear) : "",
  logoUrl: s.logoUrl ?? "", status: s.status,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school?: SchoolRow | null;
}

export function SchoolFormModal({ open, onOpenChange, school }: Props) {
  const qc = useQueryClient();
  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<SchoolFormValues>({ resolver: zodResolver(schoolFormSchema), defaultValues: empty });

  useEffect(() => {
    if (open) reset(school ? fromRow(school) : empty);
  }, [open, school, reset]);

  const save = useMutation({
    mutationFn: (v: SchoolFormValues) => {
      const payload = toSchoolPayload(v);
      return school ? adminSchoolApi.update(school.id, payload) : adminSchoolApi.create(payload);
    },
    onSuccess: () => {
      toast.success(school ? "School updated" : "School created");
      qc.invalidateQueries({ queryKey: ["schools"] });
      qc.invalidateQueries({ queryKey: ["school", school?.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const field = (name: keyof SchoolFormValues, label: string, type = "text") => (
    <FormField id={`school-${name}`} label={label} error={errors[name]?.message}>
      <Input id={`school-${name}`} type={type} aria-invalid={!!errors[name]} {...register(name)} />
    </FormField>
  );

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={school ? "Edit school" : "Add school"} description="School details and status.">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Name")}
          {field("code", "Code")}
          {field("email", "Email", "email")}
          {field("phone", "Phone")}
          {field("principal", "Principal")}
          {field("establishedYear", "Established year")}
          {field("city", "City")}
          {field("state", "State")}
          {field("country", "Country")}
          {field("postalCode", "Postal code")}
        </div>
        {field("address", "Address")}
        {field("logoUrl", "Logo URL")}
        <FormField id="school-status" label="Status" error={errors.status?.message}>
          <SelectField id="school-status" className="w-full" {...register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectField>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save school"}</Button>
        </div>
      </form>
    </FormModal>
  );
}
