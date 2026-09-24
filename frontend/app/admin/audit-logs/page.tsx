import { AuditLogTable } from "@/components/features/audit/AuditLogTable";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AuditLogsPage() {
  return (
    <>
      <PageHeader title="Audit logs" description="Every important administrative action, with who, what and where." />
      <AuditLogTable />
    </>
  );
}
