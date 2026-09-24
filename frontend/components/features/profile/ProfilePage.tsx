"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { useClasses } from "@/hooks/useLookups";
import { toApiError } from "@/lib/api/client";
import { profileApi, type ProfileData } from "@/lib/api/profile";
import { humanize } from "@/lib/admin-format";
import { fmtDate } from "@/lib/format";
import { QueryBoundary } from "../shared";

const Card = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
  <section className="rounded-2xl border bg-card p-5 shadow-sm">
    <h2 className="font-medium">{title}</h2>
    {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Fact = ({ label, value }: { label: string; value?: ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
  </div>
);

const Field = ({ id, label, children }: { id: string; label: string; children: ReactNode }) => (
  <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
);

function EditForm({ data }: { data: ProfileData }) {
  const qc = useQueryClient();
  const { user, student, teacher } = data;
  const [form, setForm] = useState({
    firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "",
    address: student?.address ?? "", gender: student?.gender ?? "", dateOfBirth: student?.dateOfBirth?.slice(0, 10) ?? "",
    qualification: teacher?.qualification ?? "",
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => profileApi.update({
      firstName: form.firstName, lastName: form.lastName, phone: form.phone || null,
      ...(student ? { address: form.address || null, gender: (form.gender || null) as "MALE" | "FEMALE" | "OTHER" | null, dateOfBirth: form.dateOfBirth || null } : {}),
      ...(teacher ? { qualification: form.qualification || null } : {}),
    }),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field id="pf-first" label="First name"><Input id="pf-first" required value={form.firstName} onChange={set("firstName")} /></Field>
      <Field id="pf-last" label="Last name"><Input id="pf-last" required value={form.lastName} onChange={set("lastName")} /></Field>
      <Field id="pf-email" label="Email (contact your administrator to change)"><Input id="pf-email" value={user.email} disabled /></Field>
      <Field id="pf-phone" label="Phone"><Input id="pf-phone" value={form.phone} onChange={set("phone")} /></Field>
      {student && (
        <>
          <Field id="pf-dob" label="Date of birth"><Input id="pf-dob" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
          <Field id="pf-gender" label="Gender">
            <NativeSelect id="pf-gender" placeholder="Not specified" value={form.gender} onChange={set("gender")}
              options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} />
          </Field>
          <div className="sm:col-span-2"><Field id="pf-address" label="Address"><Input id="pf-address" value={form.address} onChange={set("address")} /></Field></div>
        </>
      )}
      {teacher && (
        <div className="sm:col-span-2"><Field id="pf-qual" label="Qualification"><Input id="pf-qual" value={form.qualification} onChange={set("qualification")} /></Field></div>
      )}
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  );
}

function TeachingClasses({ data }: { data: ProfileData }) {
  const qc = useQueryClient();
  const classes = useClasses();
  const current = (data.teacher?.classes ?? []).map((c) => c.id);
  const [selected, setSelected] = useState<string[]>(current);
  useEffect(() => setSelected(current.slice()), [current.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => profileApi.setTeachingClasses(selected),
    onSuccess: () => {
      toast.success("Classes updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["lookup"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const items = [...(classes.data ?? [])].sort((a, b) => (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name));

  return (
    <Card title="Classes I teach" description="Choose the classes you teach. You can then see their students, take attendance and message the whole class.">
      {classes.isLoading ? <p className="text-sm text-muted-foreground">Loading classes…</p> : !items.length ? (
        <p className="text-sm text-muted-foreground">No classes exist yet. Create one under My Classes first.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.academicYear.name}{c.level != null ? ` · Level ${c.level}` : ""} · {c._count.students} students
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || classes.isLoading}>{save.isPending ? "Saving…" : "Save classes"}</Button>
      </div>
    </Card>
  );
}

export function ProfilePage() {
  const query = useQuery({ queryKey: ["profile"], queryFn: profileApi.get });
  const data = query.data;
  return (
    <>
      <PageHeader title="My profile" description="Your account details and school information." />
      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {data && (
          <div className="space-y-5">
            <Card title={`${data.user.firstName} ${data.user.lastName}`} description={humanize(data.user.role)}>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Fact label="Email" value={data.user.email} />
                <Fact label="School" value={data.user.school?.name ?? "Platform"} />
                <Fact label="Last login" value={fmtDate(data.user.lastLoginAt)} />
                {data.student && (
                  <>
                    <Fact label="Admission number" value={data.student.admissionNumber} />
                    <Fact label="Class" value={data.student.class ? `${data.student.class.name} (${data.student.class.academicYear.name})` : "Not assigned yet"} />
                    <Fact label="Class level" value={data.student.class?.level != null ? `Level ${data.student.class.level}` : undefined} />
                    <Fact label="Section" value={data.student.section?.name} />
                    <Fact label="Guardian" value={data.student.parent ? `${data.student.parent.user.firstName} ${data.student.parent.user.lastName}` : undefined} />
                  </>
                )}
                {data.teacher && (
                  <>
                    <Fact label="Employee ID" value={data.teacher.employeeId} />
                    <Fact label="Joined" value={fmtDate(data.teacher.joiningDate)} />
                    <Fact label="Subjects" value={data.teacher.subjects.map((s) => s.name).join(", ")} />
                  </>
                )}
              </dl>
              {data.student && !data.student.class && (
                <p className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                  You have not been placed in a class yet. Your school administrator or teacher will assign one and you will be notified.
                </p>
              )}
            </Card>
            <Card title="Edit details">
              <EditForm data={data} />
            </Card>
            {data.teacher && <TeachingClasses data={data} />}
          </div>
        )}
      </QueryBoundary>
    </>
  );
}
