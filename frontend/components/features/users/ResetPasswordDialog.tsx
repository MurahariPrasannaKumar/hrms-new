"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms/FormField";
import { FormModal } from "@/components/forms/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminUserApi, type UserRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { setPasswordSchema, type SetPasswordValues } from "@/schemas/user";

interface Props {
  user: UserRow | null;
  onClose: () => void;
}

/** Only admins set passwords; the user is signed out everywhere and logs in with the new one. */
export function ResetPasswordDialog({ user, onClose }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SetPasswordValues>({ resolver: zodResolver(setPasswordSchema) });
  useEffect(() => { if (!user) reset({ password: "", confirm: "" }); }, [user, reset]);

  const save = useMutation({
    mutationFn: (v: SetPasswordValues) => adminUserApi.setPassword(user!.id, v.password),
    onSuccess: () => {
      toast.success("Password updated. Share it with the user securely.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  return (
    <FormModal open={!!user} onOpenChange={(o) => !o && onClose()} title="Set password" description={user ? `${user.firstName} ${user.lastName} (${user.email})` : undefined}>
      <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => save.mutate(v))}>
        <p className="text-sm text-muted-foreground">Users cannot change their own password. This signs them out everywhere.</p>
        <FormField id="new-password" label="New password" error={errors.password?.message}>
          <Input id="new-password" type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <FormField id="new-password-confirm" label="Confirm password" error={errors.confirm?.message}>
          <Input id="new-password-confirm" type="password" autoComplete="new-password" {...register("confirm")} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Set password"}</Button>
        </div>
      </form>
    </FormModal>
  );
}
