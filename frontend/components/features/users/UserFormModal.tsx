"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SelectField } from "@/components/features/shared/SelectField";
import { FormField } from "@/components/forms/FormField";
import { FormModal } from "@/components/forms/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { academicsApi } from "@/lib/api/people";
import { adminSchoolApi, adminUserApi, type UserRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { humanize } from "@/lib/admin-format";
import {
  createUserFormSchema, editUserFormSchema, ROLE_OPTIONS, STAFF_PERMISSION_OPTIONS, STATUS_OPTIONS,
  type CreateUserValues,
} from "@/schemas/user";

type FormValues = CreateUserValues;

const empty: FormValues = {
  firstName: "", lastName: "", email: "", phone: "", password: "", role: "TEACHER", schoolId: "", classId: "", sectionId: "", status: "ACTIVE", extraPermissions: [],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  userId?: string | null;
  /** When set the school is fixed (school-detail tab or school admin). */
  lockedSchoolId?: string;
  /** Roles the current actor may assign. */
  allowedRoles?: readonly string[];
  /** Whether the actor may pick any school (super admin). */
  canPickSchool?: boolean;
}

export function UserFormModal({ open, onOpenChange, userId, lockedSchoolId, allowedRoles = ROLE_OPTIONS, canPickSchool = true }: Props) {
  const qc = useQueryClient();
  const editing = !!userId;
  const [showPassword, setShowPassword] = useState(false);
  const {
    register, handleSubmit, reset, control, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(editing ? (editUserFormSchema as unknown as typeof createUserFormSchema) : createUserFormSchema),
    defaultValues: empty,
  });

  const existing = useQuery({
    queryKey: ["user", userId],
    queryFn: () => adminUserApi.get(userId as string),
    enabled: open && editing,
  });
  const schools = useQuery({
    queryKey: ["schools", "options"],
    queryFn: () => adminSchoolApi.list({ pageSize: 100, sortBy: "name", sortOrder: "asc" }),
    enabled: open && canPickSchool && !lockedSchoolId,
  });

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      reset({ ...empty, schoolId: lockedSchoolId ?? "" });
    } else if (existing.data) {
      const u: UserRow = existing.data;
      reset({
        firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone ?? "", password: "",
        role: u.role.name as FormValues["role"], schoolId: u.schoolId ?? "", status: u.status,
        classId: u.student?.classId ?? "", sectionId: u.student?.sectionId ?? "",
        extraPermissions: u.extraPermissions?.map((p) => p.permission.key) ?? [],
      });
    }
  }, [open, editing, existing.data, lockedSchoolId, reset]);

  const role = useWatch({ control, name: "role" });
  const pickedSchool = useWatch({ control, name: "schoolId" });
  const classId = useWatch({ control, name: "classId" });
  const effectiveSchool = lockedSchoolId ?? (pickedSchool || undefined);
  const classes = useQuery({
    queryKey: ["classes", "options", effectiveSchool ?? "own"],
    queryFn: () => academicsApi.classes.list({ pageSize: 100, ...(canPickSchool && effectiveSchool ? { schoolId: effectiveSchool } : {}) }),
    enabled: open && role === "STUDENT" && (!canPickSchool || !!effectiveSchool),
    select: (d) => [...d.items].sort((a, b) => (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name)),
  });
  // Options load after the form is populated; re-apply the stored placement once they exist.
  useEffect(() => {
    const st = existing.data?.student;
    if (!editing || !classes.data || !st) return;
    setValue("classId", st.classId ?? "");
    setValue("sectionId", st.sectionId ?? "");
  }, [editing, classes.data, existing.data, setValue]);
  const sections = classes.data?.find((c) => c.id === classId)?.sections ?? [];

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const schoolId = role === "SUPER_ADMIN" ? null : lockedSchoolId ?? (v.schoolId || null);
      const common = {
        firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone || null, role: v.role, status: v.status,
        ...(canPickSchool ? { schoolId } : {}),
        ...(v.role === "STUDENT" ? { classId: v.classId || null, sectionId: v.sectionId || null } : {}),
      };
      if (editing) {
        return adminUserApi.update(userId as string, { ...common, ...(v.role === "STAFF" ? { extraPermissions: v.extraPermissions } : {}) });
      }
      return adminUserApi.create({ ...common, password: v.password });
    },
    onSuccess: () => {
      toast.success(editing ? "User updated" : "User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user", userId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const text = (name: "firstName" | "lastName" | "email" | "phone" | "password", label: string, type = "text") => (
    <FormField id={`user-${name}`} label={label} error={errors[name]?.message}>
      {name === "password" ? (
        <div className="relative">
          <Input
            id={`user-${name}`} type={showPassword ? "text" : "password"} autoComplete="off" className="pr-10"
            aria-invalid={!!errors[name]} {...register(name)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      ) : (
        <Input id={`user-${name}`} type={type} autoComplete="off" aria-invalid={!!errors[name]} {...register(name)} />
      )}
    </FormField>
  );

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={editing ? "Edit user" : "Add user"} description="Role and school determine what this user can access.">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("firstName", "First name")}
          {text("lastName", "Last name")}
        </div>
        {text("email", "Email", "email")}
        {text("phone", "Phone")}
        {!editing && text("password", "Password (set by admin)", "password")}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="user-role" label="Role" error={errors.role?.message}>
            <SelectField id="user-role" className="w-full" {...register("role")}>
              {allowedRoles.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
            </SelectField>
          </FormField>
          <FormField id="user-status" label="Status" error={errors.status?.message}>
            <SelectField id="user-status" className="w-full" {...register("status")}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </SelectField>
          </FormField>
        </div>
        {canPickSchool && !lockedSchoolId && role !== "SUPER_ADMIN" && (
          <FormField id="user-school" label="School" error={errors.schoolId?.message}>
            <SelectField id="user-school" className="w-full" {...register("schoolId")}>
              <option value="">Select a school…</option>
              {schools.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectField>
          </FormField>
        )}
        {role === "STUDENT" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="user-class" label="Class (with level)" error={errors.classId?.message}>
              <SelectField id="user-class" className="w-full" {...register("classId", { onChange: () => setValue("sectionId", "") })}>
                <option value="">{classes.isLoading ? "Loading classes…" : classes.data?.length === 0 ? "No classes in this school yet" : "Not assigned"}</option>
                {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.level != null ? ` · Level ${c.level}` : ""} ({c.academicYear.name})</option>)}
              </SelectField>
            </FormField>
            <FormField id="user-section" label="Section" error={errors.sectionId?.message}>
              <SelectField id="user-section" className="w-full" disabled={!classId} {...register("sectionId")}>
                <option value="">{classId && !sections.length ? "No sections" : "Not assigned"}</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
            </FormField>
          </div>
        )}
        {editing && role === "STAFF" && (
          <fieldset className="space-y-2 rounded-xl border p-3">
            <legend className="px-1 text-sm font-medium">Extra permissions</legend>
            <Controller
              control={control}
              name="extraPermissions"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {STAFF_PERMISSION_OPTIONS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={field.value.includes(p)}
                        onChange={(e) => field.onChange(e.target.checked ? [...field.value, p] : field.value.filter((x) => x !== p))}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              )}
            />
          </fieldset>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={save.isPending || (editing && existing.isLoading)}>{save.isPending ? "Saving…" : "Save user"}</Button>
        </div>
      </form>
    </FormModal>
  );
}
