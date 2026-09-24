"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FullPageLoader } from "@/components/feedback/LoadingSkeleton";
import { useAuth, type Role } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

/** Client-side convenience only; the backend enforces authorization on every request. */
export function RoleGuard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, session } = useAuth();
  const router = useRouter();
  const denied = session.status === "authenticated" && user && roles && !roles.includes(user.role);

  useEffect(() => {
    if (session.status === "unauthenticated") router.replace("/login");
    else if (denied && user) router.replace(homeFor(user.role));
  }, [session.status, denied, user, router]);

  if (session.status !== "authenticated" || denied) return <FullPageLoader />;
  return <>{children}</>;
}
