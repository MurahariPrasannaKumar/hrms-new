"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toApiError } from "@/lib/api/client";
import { loginSchema, type LoginValues } from "@/schemas/auth";
import { FormField } from "./FormField";

export function LoginForm({ onLogin }: { onLogin: (v: LoginValues) => Promise<void> }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onLogin(values);
    } catch (e) {
      setServerError(toApiError(e).message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{serverError}</p>}
      <FormField id="identifier" label="Email or username" error={errors.identifier?.message}>
        <Input id="identifier" autoComplete="username" aria-invalid={!!errors.identifier} className="h-11 rounded-xl" {...register("identifier")} />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
            aria-invalid={!!errors.password} className="h-11 rounded-xl pr-11" {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </FormField>
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
