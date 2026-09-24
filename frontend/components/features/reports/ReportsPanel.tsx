"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/features/shared/SelectField";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminSchoolApi, REPORT_TYPES, reportsApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { humanize } from "@/lib/admin-format";
import { useAuth } from "@/lib/auth/AuthProvider";

export function ReportsPanel({ fixedSchoolId }: { fixedSchoolId?: string } = {}) {
  const { hasRole } = useAuth();
  const isSuper = hasRole("SUPER_ADMIN");
  const [type, setType] = useState<string>(REPORT_TYPES[0].value);
  const [pickedSchool, setSchoolId] = useState("");
  const schoolId = fixedSchoolId ?? pickedSchool;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = { schoolId: schoolId || undefined, from: from || undefined, to: to || undefined };
  const schools = useQuery({
    queryKey: ["schools", "options"],
    queryFn: () => adminSchoolApi.list({ pageSize: 100, sortBy: "name", sortOrder: "asc" }),
    enabled: isSuper && !fixedSchoolId,
  });
  const report = useQuery({ queryKey: ["report", type, params], queryFn: () => reportsApi.run(type, params) });
  const exportCsv = useMutation({
    mutationFn: () => reportsApi.downloadCsv(type, params),
    onError: (e) => toast.error(toApiError(e).message),
  });

  const rows = report.data?.rows ?? [];
  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Report</span>
          <SelectField value={type} onChange={(e) => setType(e.target.value)} aria-label="Report type">
            {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>
        </label>
        {isSuper && !fixedSchoolId && (
          <label className="space-y-1 text-sm">
            <span className="block font-medium">School</span>
            <SelectField value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="School">
              <option value="">All schools</option>
              {schools.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectField>
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="block font-medium">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40 rounded-xl" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40 rounded-xl" />
        </label>
        <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending || !rows.length}>
          <Download className="size-4" /> {exportCsv.isPending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {report.error ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : report.isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : !rows.length ? (
        <EmptyState title="No data" description={report.data?.note ?? "No records match these filters."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>{cols.map((c) => <TableHead key={c}>{humanize(c.replace(/([A-Z])/g, "_$1"))}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{String(r[c] ?? "—")}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
