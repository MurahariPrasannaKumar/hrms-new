"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuditLogTable } from "@/components/features/audit/AuditLogTable";
import { ReportsPanel } from "@/components/features/reports/ReportsPanel";
import { UsersPanel } from "@/components/features/users/UsersPanel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminSchoolApi, modulesApi } from "@/lib/api/admin";
import { formatDate } from "@/lib/admin-format";
import { SchoolFormModal } from "./SchoolFormModal";
import { SchoolResourceTab, SCHOOL_TABS } from "./SchoolResourceTab";
import { SchoolModules } from "./SchoolModules";

const TABS = [
  ["overview", "Overview"], ["users", "Users"], ["students", "Students"], ["teachers", "Teachers"], ["classes", "Classes"],
  ["attendance", "Attendance"], ["academics", "Academics"], ["notices", "Notices"], ["reports", "Reports"],
  ["settings", "Settings"], ["audit", "Audit Logs"],
] as const;

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export function SchoolDetail({ id }: { id: string }) {
  const [editing, setEditing] = useState(false);
  const school = useQuery({ queryKey: ["school", id], queryFn: () => adminSchoolApi.get(id) });
  const modules = useQuery({ queryKey: ["modules", "school", id], queryFn: () => modulesApi.list(id) });

  if (school.error) return <ErrorState error={school.error} onRetry={() => school.refetch()} />;
  if (school.isLoading || !school.data) return <Skeleton className="h-64 w-full rounded-2xl" />;
  const s = school.data;

  return (
    <>
      <Link href="/admin/schools" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All schools
      </Link>
      <PageHeader
        title={s.name}
        description={`${s.code} · ${[s.city, s.country].filter(Boolean).join(", ") || "No location"}`}
        actions={<><StatusBadge status={s.status} /><Button variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button></>}
      />
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            {TABS.map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <Card>
            <CardContent className="grid gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <dl className="contents">
                <Fact label="Principal" value={s.principal} />
                <Fact label="Email" value={s.email} />
                <Fact label="Phone" value={s.phone} />
                <Fact label="Address" value={[s.address, s.city, s.state, s.postalCode].filter(Boolean).join(", ")} />
                <Fact label="Established" value={s.establishedYear} />
                <Fact label="Created" value={formatDate(s.createdAt)} />
                <Fact label="Users" value={s._count?.users} />
                <Fact label="Students" value={s._count?.students} />
                <Fact label="Teachers" value={s._count?.teachers} />
                <Fact label="Staff" value={s._count?.staff} />
                <Fact label="Classes" value={s._count?.classes} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users"><UsersPanel schoolId={id} showHeader={false} /></TabsContent>
        {(Object.keys(SCHOOL_TABS) as (keyof typeof SCHOOL_TABS)[]).map((k) => (
          <TabsContent key={k} value={k}><SchoolResourceTab schoolId={id} tab={k} /></TabsContent>
        ))}
        <TabsContent value="reports"><ReportsPanel fixedSchoolId={id} /></TabsContent>
        <TabsContent value="settings"><SchoolModules schoolId={id} modules={modules.data} loading={modules.isLoading} error={modules.error} /></TabsContent>
        <TabsContent value="audit"><AuditLogTable schoolId={id} /></TabsContent>
      </Tabs>
      <SchoolFormModal open={editing} onOpenChange={setEditing} school={s} />
    </>
  );
}
