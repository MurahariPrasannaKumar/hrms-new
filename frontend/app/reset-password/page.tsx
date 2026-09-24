"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms/FormField";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { toApiError } from "@/lib/api/client";
import { resetPasswordSchema, type ResetPasswordValues } from "@/schemas/auth";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token) return <p role="alert" className="text-sm text-destructive">This reset link is missing its token. Request a new one.</p>;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setError(null);
        try {
          await authApi.resetPassword(token, v.password);
          toast.success("Password updated. Please sign in.");
          router.replace("/login");
        } catch (e) { setError(toApiError(e).message); }
      })}
    >
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <FormField id="password" label="New password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" className="h-11 rounded-xl" {...register("password")} />
      </FormField>
      <FormField id="confirm" label="Confirm password" error={errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" className="h-11 rounded-xl" {...register("confirm")} />
      </FormField>
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>Reset password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Reset password" description="Choose a new password for your account.">
      <Suspense><ResetForm /></Suspense>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
