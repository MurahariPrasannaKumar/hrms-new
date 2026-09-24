"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms/FormField";
import { AuthShell } from "@/components/layout/AuthShell";
import { RoleGuard } from "@/components/navigation/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { toApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { changePasswordSchema, type ChangePasswordValues } from "@/schemas/auth";

function ChangePasswordForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  return (
    <AuthShell title="Change password" description="Use a strong password you don’t use elsewhere.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          try {
            await authApi.changePassword(v.currentPassword, v.newPassword);
            toast.success("Password changed");
            router.replace(user ? homeFor(user.role) : "/");
          } catch (e) { setError(toApiError(e).message); }
        })}
      >
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <FormField id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
          <Input id="currentPassword" type="password" autoComplete="current-password" className="h-11 rounded-xl" {...register("currentPassword")} />
        </FormField>
        <FormField id="newPassword" label="New password" error={errors.newPassword?.message}>
          <Input id="newPassword" type="password" autoComplete="new-password" className="h-11 rounded-xl" {...register("newPassword")} />
        </FormField>
        <FormField id="confirm" label="Confirm new password" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" className="h-11 rounded-xl" {...register("confirm")} />
        </FormField>
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>Update password</Button>
      </form>
    </AuthShell>
  );
}

export default function ChangePasswordPage() {
  return <RoleGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}><ChangePasswordForm /></RoleGuard>;
}
