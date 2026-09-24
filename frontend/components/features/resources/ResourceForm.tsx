"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api/client";
import { fileService, resourceService, type ResourceArea, type ResourceType } from "@/lib/api/learning-ai";

const TYPES: ResourceType[] = ["VIDEO", "PRESENTATION", "DOCUMENT", "INTERACTIVE", "LESSON_PLAN", "OTHER"];

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(["VIDEO", "PRESENTATION", "DOCUMENT", "INTERACTIVE", "LESSON_PLAN", "OTHER"]),
  category: z.string().trim().max(100).optional(),
  url: z.union([z.literal(""), z.string().url("Enter a valid URL (https://…)")]).optional(),
});
type Values = z.infer<typeof schema>;

/** Uploads the optional file through /files first, then creates the resource pointing at it. */
export function ResourceForm({ area, onDone }: { area: ResourceArea; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", type: area === "pedagogy" ? "LESSON_PLAN" : "VIDEO", category: "", url: "" },
  });
  const save = useMutation({
    mutationFn: async (v: Values) => {
      if (!file && !v.url) throw new Error("Attach a file or provide a link");
      const fileId = file ? (await fileService.upload(file)).id : undefined;
      return resourceService.create({
        title: v.title, description: v.description || undefined, type: v.type, category: v.category || undefined,
        area, fileId, url: v.url || undefined,
      });
    },
    onSuccess: () => { toast.success("Resource added"); onDone(); },
    onError: (e) => toast.error(e instanceof Error && !("status" in e) ? e.message : toApiError(e).message),
  });

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
      <FormField id="r-title" label="Title" error={errors.title?.message}>
        <Input id="r-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField id="r-desc" label="Description (optional)">
        <Textarea id="r-desc" rows={3} {...register("description")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="r-type" label="Type">
          <NativeSelect id="r-type" {...register("type")}>
            {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="r-cat" label="Category / subject">
          <Input id="r-cat" placeholder="e.g. Science" {...register("category")} />
        </FormField>
      </div>
      <FormField id="r-url" label="Link (optional)" error={errors.url?.message}>
        <Input id="r-url" type="url" placeholder="https://…" {...register("url")} />
      </FormField>
      <FormField id="r-file" label="or upload a file">
        <Input id="r-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </FormField>
      <Button type="submit" disabled={save.isPending}>{save.isPending ? "Uploading…" : "Add resource"}</Button>
    </form>
  );
}
