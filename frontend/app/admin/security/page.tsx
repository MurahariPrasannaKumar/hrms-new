import { SecurityPanel } from "@/components/features/security/SecurityPanel";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Security" description="Sign-in activity, active sessions and suspicious behaviour across the platform." />
      <SecurityPanel />
    </>
  );
}
