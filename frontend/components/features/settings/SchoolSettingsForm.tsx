"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ErrorState } from "@/components/feedback/ErrorState";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api/client";
import { settingsApi, type SchoolSettings } from "@/lib/api/settings";

const text = z.string().trim().max(255);
const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(150),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  phone: text, address: text, city: text, state: text, country: text, postalCode: text, principal: text, logoUrl: text,
  establishedYear: z.string().trim().regex(/^\d{4}$|^$/, "Enter a 4-digit year"),
  timezone: z.string().trim().min(1, "Required").max(60),
  locale: z.string().trim().min(2, "Required").max(10),
});
type Values = z.infer<typeof schema>;

const toValues = (d: SchoolSettings): Values => ({
  name: d.profile.name, email: d.profile.email ?? "", phone: d.profile.phone ?? "", address: d.profile.address ?? "",
  city: d.profile.city ?? "", state: d.profile.state ?? "", country: d.profile.country ?? "", postalCode: d.profile.postalCode ?? "",
  principal: d.profile.principal ?? "", logoUrl: d.profile.logoUrl ?? "",
  establishedYear: d.profile.establishedYear ? String(d.profile.establishedYear) : "", timezone: d.timezone, locale: d.locale,
});

const blank = (v: string) => (v === "" ? null : v);

const FIELDS: { id: keyof Values; label: string; type?: string }[] = [
  { id: "name", label: "School name" }, { id: "principal", label: "Principal" },
  { id: "email", label: "Email", type: "email" }, { id: "phone", label: "Phone" },
  { id: "address", label: "Address" }, { id: "city", label: "City" },
  { id: "state", label: "State" }, { id: "country", label: "Country" },
  { id: "postalCode", label: "Postal code" }, { id: "establishedYear", label: "Established year" },
  { id: "logoUrl", label: "Logo URL" }, { id: "timezone", label: "Timezone (e.g. Asia/Kolkata)" },
  { id: "locale", label: "Locale (e.g. en)" },
];

export function SchoolSettingsForm() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "school"], queryFn: settingsApi.getSchool });
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => { if (query.data) reset(toValues(query.data)); }, [query.data, reset]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      settingsApi.saveSchool({
        timezone: v.timezone,
        locale: v.locale,
        profile: {
          name: v.name, email: blank(v.email), phone: blank(v.phone), address: blank(v.address), city: blank(v.city),
          state: blank(v.state), country: blank(v.country), postalCode: blank(v.postalCode), principal: blank(v.principal),
          logoUrl: blank(v.logoUrl), establishedYear: v.establishedYear ? Number(v.establishedYear) : null,
        },
      }),
    onSuccess: (data) => {
      toast.success("School settings saved");
      qc.setQueryData(["settings", "school"], data);
      reset(toValues(data));
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          School profile
          {query.data && <span className="ml-2 text-sm font-normal text-muted-foreground">Code {query.data.profile.code}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          {FIELDS.map((f) => (
            <FormField key={f.id} id={`school-${f.id}`} label={f.label} error={errors[f.id]?.message}>
              <Input id={`school-${f.id}`} type={f.type} {...register(f.id)} />
            </FormField>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending || !isDirty}>{save.isPending ? "Saving..." : "Save changes"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
