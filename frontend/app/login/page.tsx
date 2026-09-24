"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoginForm } from "@/components/forms/LoginForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

export default function LoginPage() {
  const { login, user, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "authenticated" && user) router.replace(homeFor(user.role));
  }, [session.status, user, router]);

  return (
    <AuthShell title="Sign in" description="Welcome back to EduSphere.">
      <LoginForm
        onLogin={async (v) => {
          const res = await login(v.identifier, v.password);
          router.replace(res.mustChangePassword ? "/change-password" : homeFor(res.user.role));
        }}
      />
      <p className="mt-4 text-center text-sm">
        <span className="text-muted-foreground">Forgot your password? Contact your administrator.</span>
      </p>
    </AuthShell>
  );
}
