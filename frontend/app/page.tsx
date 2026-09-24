"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageLoader } from "@/components/feedback/LoadingSkeleton";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

export default function RootPage() {
  const { user, session } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "authenticated" && user) router.replace(homeFor(user.role));
    else if (session.status === "unauthenticated") router.replace("/login");
  }, [session.status, user, router]);
  return <FullPageLoader />;
}
