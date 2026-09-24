"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RoleGuard } from "@/components/navigation/RoleGuard";

export default function AreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard roles={["SCHOOL_ADMIN"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
