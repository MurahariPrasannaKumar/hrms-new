import { SecurityPanel } from "@/components/features/security/SecurityPanel";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SchoolSecurityPage() {
  return (
    <>
      <PageHeader title="Security" description="Sign-in activity, active sessions and audit trail for your school." />
      <SecurityPanel />
    </>
  );
}
