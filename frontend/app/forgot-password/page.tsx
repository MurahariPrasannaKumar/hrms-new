"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { toApiError } from "@/lib/api/client";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/schemas/auth";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  return (
    <AuthShell title="Forgot password" description="We’ll email you a link to reset it.">
      {done ? (
        <p role="status" className="text-sm">If an account exists for that email, a reset link has been sent.</p>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (v) => {
            setError(null);
            try { await authApi.forgotPassword(v.email); setDone(true); } catch (e) { setError(toApiError(e).message); }
          })}
        >
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" className="h-11 rounded-xl" {...register("email")} />
          </FormField>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
