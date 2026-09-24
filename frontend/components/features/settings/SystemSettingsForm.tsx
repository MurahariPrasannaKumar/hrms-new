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
import { settingsApi } from "@/lib/api/settings";

const schema = z.object({
  platformName: z.string().trim().min(2, "At least 2 characters").max(80),
  supportEmail: z.string().trim().email("Enter a valid email").or(z.literal("")),
  defaultLocale: z.string().trim().min(2, "Required").max(10),
  maintenanceMode: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function SystemSettingsForm() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "system"], queryFn: settingsApi.getSystem });
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => { if (query.data) reset(query.data); }, [query.data, reset]);

  const save = useMutation({
    mutationFn: settingsApi.saveSystem,
    onSuccess: (data) => { toast.success("Settings saved"); qc.setQueryData(["settings", "system"], data); reset(data); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <Card>
      <CardHeader><CardTitle>Platform settings</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
          <FormField id="platformName" label="Platform name" error={errors.platformName?.message}>
            <Input id="platformName" {...register("platformName")} />
          </FormField>
          <FormField id="supportEmail" label="Support email" error={errors.supportEmail?.message}>
            <Input id="supportEmail" type="email" {...register("supportEmail")} />
          </FormField>
          <FormField id="defaultLocale" label="Default locale" error={errors.defaultLocale?.message}>
            <Input id="defaultLocale" placeholder="en" {...register("defaultLocale")} />
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4" {...register("maintenanceMode")} />
            Maintenance mode
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending || !isDirty}>{save.isPending ? "Saving..." : "Save changes"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
